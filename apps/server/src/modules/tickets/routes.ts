import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import * as shared from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { requireAuth } from '../identity/index.js';
import { isOnRoster, ticketPartsAfterWrite, type AppConfig } from '../../kernel/index.js';
import * as tm from './mapper.js';
import { buildCommand } from './builders.js';
import * as sql from './repo/ticket.js';
import * as idem from './repo/idempotency.js';
import * as report from './repo/report.js';
import { runOutcome } from './outcome.js';
import { boardToday } from './board.js';
import { registerPast } from './past.js';
import { detail, listTickets, loadState } from './list.js';
import {
  checkCorrectedRefs,
  fillReplacedMinutes,
  recordAdminFix,
  saveCorrectedMachine,
} from './admin-fixes.js';
import { resolveActingPerson } from './acting.js';
import { afterClose, checkTaskInput } from './tasks.js';
import { preparePmClose } from './pm-close.js';
import { checkHandoverTarget } from './targets.js';
import { loginInTicketCell, otherCellRefusal, reopenConflict } from './handback.js';
import { checkLockout, lockoutField } from './lockout.js';
import { refreshSeverity } from './severity.js';
import { registerOemCauseRoutes } from './oem-cause-routes.js';
import { registerWhyWhyRoutes } from './why-why-routes.js';
import { registerPmRoutes } from './pm-routes.js';
import { registerDeskReads } from './desk-reads.js';
import { raise } from './raise.js';

export type Auth = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
export type Outcome = tm.Outcome;

const COMMAND_SCHEMAS: Record<tm.CommandAction, z.ZodTypeAny> = {
  start: shared.startTicketSchema,
  join: shared.joinTicketSchema,
  leave: shared.leaveTicketSchema,
  pause: shared.pauseTicketSchema,
  resume: shared.resumeTicketSchema,
  transfer: shared.transferTicketSchema,
  update: shared.updateTicketSchema,
  'machine-running': shared.machineRunningSchema,
  'machine-stopped': shared.machineStoppedSchema,
  close: shared.closeTicketSchema,
  report: shared.reportTicketSchema,
  cancel: shared.cancelTicketSchema,
  restore: shared.restoreTicketSchema,
  correct: shared.correctTicketSchema,
  'upgrade-kind': shared.upgradeKindSchema,
  acknowledge: shared.acknowledgeTicketSchema,
  'acknowledge-escalation': shared.acknowledgeEscalationSchema,
  handback: shared.handbackTicketSchema,
  'lockout-confirm': shared.lockoutConfirmSchema,
};

async function loadTicketContext(client: PoolClient, tx: tm.Tx): Promise<tm.LoadedCtx | null> {
  const row = await sql.loadTicketRow(client, tx.ticketId, tx.tenantId);
  if (!row) return null;
  const events = await sql.loadEvents(client, tx.ticketId);
  return {
    row,
    ticket: tm.rowToTicket(row),
    extras: tm.rowExtras(row),
    events,
    segments: await sql.loadSegments(client, tx.ticketId),
    crew: await sql.loadCrew(client, tx.ticketId),
    onRoster:
      tx.action === 'acknowledge' && tx.actingPersonId !== null
        ? await isOnRoster(client, tx.tenantId, tx.actingPersonId, new Date())
        : false,
    pendingLevels: domain.pendingEscalationLevels(events),
    sameCell: tx.action === 'handback' ? loginInTicketCell(tx, row) : false,
  };
}

/** The refusals a command earns before anything is written: a bad task, and a PM report that does not check out. */
async function commandRefusal(
  client: PoolClient,
  tx: tm.Tx,
  loaded: tm.LoadedCtx,
): Promise<Outcome | null> {
  return (await checkTaskInput(client, tx, loaded)) ?? (await preparePmClose(client, tx, loaded));
}

async function executeCommand(
  client: PoolClient,
  tx: tm.Tx,
  binding: idem.IdempotencyBinding,
  boss?: PgBoss,
): Promise<Outcome> {
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  const acting = await resolveActingPerson(client, tx);
  if ('status' in acting) return acting;
  tx.actingPersonId = acting.personId;

  const denied = tm.gatePermission(tx.action, tx, tx.actingPersonId);
  if (denied) return denied;
  const badTarget = await checkHandoverTarget(client, tx);
  if (badTarget) return badTarget;
  const loaded = await loadTicketContext(client, tx);
  if (!loaded) return { status: 404, body: shared.apiError('not_found', 'Unknown ticket') };

  const unknown = await checkCorrectedRefs(client, tx, loaded);
  if (unknown) return unknown;
  const lockout = await checkLockout(client, tx);
  if (lockout) return lockout;
  // The PM report is built before the close stores it (49c, R8); a refusal here has written nothing.
  const refused = await commandRefusal(client, tx, loaded);
  if (refused) return refused;
  const command = buildCommand(tx, tx.actingPersonId ?? '', loaded);
  const result = tm.applyTransition(tx, tx.actingPersonId, loaded, command);
  if ('status' in result) return otherCellRefusal(tx, loaded.row, result);
  const blocked = await reopenConflict(client, tx, loaded.ticket);
  if (blocked) return blocked;
  fillReplacedMinutes(loaded, result.events);
  // M2-2.1: a correction or kind upgrade may change the derived severity.
  await refreshSeverity(client, tx, loaded, result.ticket);
  await sql.persistResult(client, tx, loaded, result);
  await saveCorrectedMachine(client, tx, loaded);
  await recordAdminFix(client, tx, loaded, result);
  await report.storeReportForTransition(client, tx, result, loaded.extras.raisedChannel);
  const left = await afterClose(client, tx, loaded, result.ticket);
  const parts = await ticketPartsAfterWrite(client, {
    tenantId: tx.tenantId,
    ticketId: tx.ticketId,
    now: new Date(),
    boss,
    command: tx.action,
    actor: tx.auth,
  });

  const outcome: Outcome = {
    status: 200,
    body: {
      ticket: {
        ...tm.ticketProjection(result.ticket, loaded.extras),
        ...parts,
        ...(await lockoutField(client, tx, tx.ticketId)),
      },
      ...left,
    },
  };
  await idem.storeIdempotent(client, { ...binding, command: tx.action, result: outcome });
  return outcome;
}

async function runCommand(
  config: AppConfig,
  request: FastifyRequest,
  reply: FastifyReply,
  action: tm.CommandAction,
): Promise<void> {
  const { pool } = config;
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply.code(422).send(shared.apiError('validation', idem.KEY_REQUIRED, 'idempotencyKey'));
    return;
  }
  const parsed = COMMAND_SCHEMAS[action].safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(shared.apiError('validation', 'Invalid request', field || undefined));
    return;
  }
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    action,
    parsed.data,
    idem.phoneActor(ctx),
  ]);
  const tx: tm.Tx = {
    tenantId: ctx.tenantId,
    ticketId: (request.params as { id: string }).id,
    key,
    action,
    body: parsed.data as Record<string, unknown>,
    auth: ctx,
    actingPersonId: null,
  };
  const outcome = await runOutcome(pool, binding, (client) =>
    executeCommand(client, tx, binding, config.jobBoss),
  );
  reply.code(outcome.status).send(outcome.body);
}

async function state(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const { open, needReport } = await loadState(pool, ctx.tenantId, ctx);
  reply.send({ open, needReport, now: new Date().toISOString() });
}

export function registerTickets(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.post('/api/v1/tickets', (request, reply) => raise(pool, request, reply, config.jobBoss));
  registerPast(app, config);
  app.get('/api/v1/tickets', (request, reply) => listTickets(pool, request, reply));
  app.get('/api/v1/state', (request, reply) => state(pool, request, reply));
  app.get('/api/v1/board/today', (request, reply) => boardToday(pool, request, reply));
  app.get('/api/v1/tickets/:id', (request, reply) => detail(pool, request, reply));
  for (const action of Object.keys(COMMAND_SCHEMAS) as tm.CommandAction[]) {
    app.post(`/api/v1/tickets/:id/${action}`, (request, reply) =>
      runCommand(config, request, reply, action),
    );
  }
  registerWhyWhyRoutes(app, pool);
  registerOemCauseRoutes(app, pool);
  registerPmRoutes(app, pool);
  registerDeskReads(app, pool);
}
