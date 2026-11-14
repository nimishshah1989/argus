import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import * as shared from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { requireAuth } from '../identity/index.js';
import { machinesByIds } from '../plant/index.js';
import {
  actingRefusal,
  AUTH_MESSAGES,
  isOnRoster,
  ticketPartsAfterWrite,
  type AppConfig,
} from '../../kernel/index.js';
import * as tm from './mapper.js';
import { buildCommand } from './builders.js';
import * as sql from './repo/ticket.js';
import * as idem from './repo/idempotency.js';
import * as report from './repo/report.js';
import { ALREADY_OPEN, runOutcome } from './outcome.js';
import { boardToday } from './board.js';
import { registerPast } from './past.js';
import { detail, listTickets, loadState } from './list.js';
import { openDuplicateId } from './repo/list.js';
import {
  checkCorrectedRefs,
  machineSwitchedOff,
  fillReplacedMinutes,
  recordAdminFix,
  saveCorrectedMachine,
} from './admin-fixes.js';
import { checkHandoverTarget } from './targets.js';
import { loginInTicketCell, reopenConflict } from './handback.js';
import { checkLockout, holdStartForLockout, lockoutField } from './lockout.js';
import { buildRaiseExtras, buildRaised, loadSeverityMatrix, refreshSeverity } from './severity.js';

type Auth = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
type Outcome = tm.Outcome;

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

interface RaiseTx {
  tenantId: string;
  key: string;
  auth: Auth;
  body: Record<string, unknown>;
}

/**
 * Who acts is always the session's person (a shared phone's chosen one), never one a request names; a correction
 * is the admin's own act. The read is locked, so a switch-off that is under way finishes first: a person already
 * off is no longer signed in.
 */
async function resolveActingPerson(
  client: PoolClient,
  tx: tm.Tx,
): Promise<{ personId: string | null } | Outcome> {
  if (tx.action === 'correct') return { personId: tx.auth.personId };
  const refused = actingRefusal(tx.auth, tx.body.personId as string | undefined, 'personId');
  if (refused) return refused;
  if (!(await sql.personExists(client, tx.tenantId, tx.auth.personId!))) {
    return { status: 401, body: shared.apiError('unauthenticated', AUTH_MESSAGES.ended) };
  }
  return { personId: tx.auth.personId };
}

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
    sameCell: tx.action === 'handback' ? await loginInTicketCell(client, tx, row) : false,
  };
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
  const command = buildCommand(tx, tx.actingPersonId ?? '', loaded);
  const result = tm.applyTransition(tx, tx.actingPersonId, loaded, command);
  if ('status' in result) return result;
  const blocked = await reopenConflict(client, tx, loaded.ticket);
  if (blocked) return blocked;
  fillReplacedMinutes(loaded, result.events);
  // M2-2.1: a correction or kind upgrade may change the derived severity.
  await refreshSeverity(client, tx, loaded, result.ticket);
  await sql.persistResult(client, tx, loaded, result);
  await saveCorrectedMachine(client, tx, loaded);
  await recordAdminFix(client, tx, loaded, result);
  await report.storeReportForTransition(client, tx, result);
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
    reply
      .code(422)
      .send(shared.apiError('validation', 'Idempotency-Key header is required', 'idempotencyKey'));
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

async function validateMachine(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ snapshot: Record<string, unknown>; criticality: string | null } | Outcome> {
  await sql.lockRefCounter(client, tx.tenantId, 'BD');
  if (!tx.body.machineId) return { snapshot: {}, criticality: null };
  const machine = (
    await machinesByIds(client, tx.tenantId, [tx.body.machineId as string], 'share')
  )[0];
  if (!machine)
    return { status: 404, body: shared.apiError('not_found', 'Unknown machine', 'machineId') };
  // A phone holding an old copy of the config may still offer a machine that has since been switched off.
  if (machine.status === 'scrapped') return machineSwitchedOff('machineId');
  const duplicate = await openDuplicateId(client, tx.tenantId, tx.body.machineId as string);
  if (duplicate) return ALREADY_OPEN;
  const { code, category, cell, criticality } = machine;
  return { snapshot: { code, category, cell, criticality }, criticality };
}

/**
 * Who a raise may name. The one who starts the work is the person acting, and only maintenance starts work; a
 * reporter other than the person acting (a technician taking a call) is for maintenance too, an operator reports as
 * themselves. Refused before anything is looked up, so a refusal says nothing about who exists.
 */
function raiseRefusal(tx: RaiseTx): Outcome | null {
  const { role, loginId, personId, shared: sharedLogin } = tx.auth;
  const maintenance = domain.canWork({
    role: role as domain.Role,
    loginId,
    personId,
    shared: sharedLogin,
  });
  if (tx.body.startNow || tx.body.startByPersonId !== undefined) {
    const named = tx.body.startByPersonId as string | undefined;
    const refused = actingRefusal(tx.auth, named, 'startByPersonId');
    if (refused) return refused;
    if (tx.body.startNow && !maintenance) {
      return {
        status: 403,
        body: shared.apiError(
          'forbidden',
          'You do not have permission for this action',
          'startNow',
        ),
      };
    }
  }
  const reporter = tx.body.reportedByPersonId as string | undefined;
  if (reporter !== undefined && reporter !== personId && !maintenance) {
    return {
      status: 403,
      body: shared.apiError('forbidden', 'You may only report as yourself', 'reportedByPersonId'),
    };
  }
  return null;
}

async function validateRaisePeople(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ reportedByPersonId: string | null } | Outcome> {
  const refused = raiseRefusal(tx);
  if (refused) return refused;
  const reportedByPersonId = (tx.body.reportedByPersonId as string | undefined) ?? tx.auth.personId;
  if (reportedByPersonId && !(await sql.personExists(client, tx.tenantId, reportedByPersonId))) {
    return {
      status: 404,
      body: shared.apiError('not_found', 'Unknown reporter', 'reportedByPersonId'),
    };
  }
  // Starting at the raise names a person who starts; a flagged work type is held open for its lockout instead.
  await holdStartForLockout(client, tx);
  return { reportedByPersonId };
}

async function executeRaise(
  client: PoolClient,
  tx: RaiseTx,
  binding: idem.IdempotencyBinding,
  boss?: PgBoss,
): Promise<Outcome> {
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  const machine = await validateMachine(client, tx);
  // A same-key raise may have committed in between: replay its stored result, not a duplicate error.
  if ('status' in machine) return (await idem.getIdempotent(client, binding)) ?? machine;
  const people = await validateRaisePeople(client, tx);
  if ('status' in people) return people;
  const ref = await sql.allocateRef(client, tx.tenantId, String(tx.body.kind));
  const now = new Date();
  const severityMatrix = await loadSeverityMatrix(client, tx.tenantId);
  const criticality = machine.criticality as domain.Criticality | null;
  const raised = buildRaised({
    ref,
    body: { ...tx.body, startByPersonId: tx.auth.personId ?? undefined },
    loginId: tx.auth.loginId,
    reportedByPersonId: people.reportedByPersonId,
    now,
    criticality,
    severityMatrix,
  });
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now,
  });
  const extras = buildRaiseExtras(machine.snapshot, tx.body, criticality, severityMatrix);
  await sql.insertTicket(client, tx.tenantId, raised.ticket, extras);
  await sql.persistEvents(client, tx.tenantId, raised.ticket.id, {
    events: raised.events,
    startSeq: 0,
    idempotencyKey: tx.key,
    loginId: tx.auth.loginId,
    actingPersonId: tx.auth.personId,
    textFor: () => tx.body.problem as string,
  });
  await sql.persistSegments(client, tx.tenantId, raised.ticket.id, { ...raised, endReason: null });
  const parts = await ticketPartsAfterWrite(client, {
    tenantId: tx.tenantId,
    ticketId: raised.ticket.id,
    now,
    boss,
    command: 'raise',
    actor: tx.auth,
  });
  const lockout = await lockoutField(client, tx, raised.ticket.id);
  const outcome: Outcome = {
    status: 201,
    body: { ticket: { ...tm.ticketProjection(raised.ticket, extras), ...parts, ...lockout } },
  };
  await idem.storeIdempotent(client, { ...binding, command: 'raise', result: outcome });
  return outcome;
}

async function raise(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  boss?: PgBoss,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply
      .code(422)
      .send(shared.apiError('validation', 'Idempotency-Key header is required', 'idempotencyKey'));
    return;
  }
  const parsed = shared.raiseTicketSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(shared.apiError('validation', 'Invalid ticket', field || undefined));
    return;
  }
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    'raise',
    parsed.data,
    idem.phoneActor(ctx),
  ]);
  const tx: RaiseTx = {
    tenantId: ctx.tenantId,
    key,
    auth: ctx,
    body: parsed.data as Record<string, unknown>,
  };
  const outcome = await runOutcome(pool, binding, (client) =>
    executeRaise(client, tx, binding, boss),
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
}
