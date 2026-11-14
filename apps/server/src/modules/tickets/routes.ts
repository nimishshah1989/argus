import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import * as shared from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { machinesByIds } from '../plant/index.js';
import { ticketPartsAfterWrite, withTicketParts, type AppConfig } from '../../kernel/index.js';
import * as tm from './mapper.js';
import * as sql from './repo/ticket.js';
import * as idem from './repo/idempotency.js';
import * as report from './repo/report.js';
import { ALREADY_OPEN, runOutcome } from './outcome.js';
import { registerPast } from './past.js';
import { detail, listNeedReport, listTickets, projectTicket } from './list.js';
import { openDuplicateId, openTicketRows } from './repo/list.js';
import {
  checkCorrectedRefs,
  machineSwitchedOff,
  fillReplacedMinutes,
  recordAdminFix,
  saveCorrectedMachine,
} from './admin-fixes.js';
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
};

interface RaiseTx {
  tenantId: string;
  key: string;
  auth: Auth;
  body: Record<string, unknown>;
}

async function resolveActingPerson(
  client: PoolClient,
  tx: tm.Tx,
): Promise<{ personId: string | null } | Outcome> {
  const useSession = tx.action === 'correct' || tx.action === 'upgrade-kind';
  if (useSession) return { personId: tx.auth.personId };
  const bodyPersonId = tx.body.personId as string | undefined;
  if (!tx.auth.shared) {
    if (bodyPersonId !== tx.auth.personId) {
      return {
        status: 403,
        body: shared.apiError('forbidden', 'You may only act as yourself', 'personId'),
      };
    }
    return { personId: tx.auth.personId };
  }
  if (!bodyPersonId || !(await sql.personExists(client, tx.tenantId, bodyPersonId))) {
    return { status: 404, body: shared.apiError('not_found', 'Unknown person', 'personId') };
  }
  return { personId: bodyPersonId };
}

async function loadTicketContext(client: PoolClient, tx: tm.Tx): Promise<tm.LoadedCtx | null> {
  const row = await sql.loadTicketRow(client, tx.ticketId, tx.tenantId);
  if (!row) return null;
  return {
    row,
    ticket: tm.rowToTicket(row),
    extras: tm.rowExtras(row),
    events: await sql.loadEvents(client, tx.ticketId),
    segments: await sql.loadSegments(client, tx.ticketId),
    crew: await sql.loadCrew(client, tx.ticketId),
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
  const loaded = await loadTicketContext(client, tx);
  if (!loaded) return { status: 404, body: shared.apiError('not_found', 'Unknown ticket') };

  const unknown = await checkCorrectedRefs(client, tx, loaded);
  if (unknown) return unknown;
  const command = tm.buildCommand(tx, tx.actingPersonId ?? '', loaded);
  const result = tm.applyTransition(tx, tx.actingPersonId, loaded, command);
  if ('status' in result) return result;
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
  });

  const outcome: Outcome = {
    status: 200,
    body: { ticket: { ...tm.ticketProjection(result.ticket, loaded.extras), ...parts } },
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
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [action, parsed.data]);
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

async function validateRaisePeople(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ reportedByPersonId: string | null } | Outcome> {
  const reportedByPersonId = (tx.body.reportedByPersonId as string | undefined) ?? tx.auth.personId;
  if (reportedByPersonId && !(await sql.personExists(client, tx.tenantId, reportedByPersonId))) {
    return {
      status: 404,
      body: shared.apiError('not_found', 'Unknown reporter', 'reportedByPersonId'),
    };
  }
  if (
    tx.body.startByPersonId &&
    !(await sql.personExists(client, tx.tenantId, tx.body.startByPersonId as string))
  ) {
    return { status: 404, body: shared.apiError('not_found', 'Unknown person', 'startByPersonId') };
  }
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
  if ('status' in machine) {
    // A concurrent same-key raise may have committed between our idempotency check and this
    // duplicate-machine probe; replay its stored result instead of failing on the duplicate.
    return (await idem.getIdempotent(client, binding)) ?? machine;
  }
  const people = await validateRaisePeople(client, tx);
  if ('status' in people) return people;
  const ref = await sql.allocateRef(
    client,
    tx.tenantId,
    tx.body.kind as 'stopped' | 'support' | 'general',
  );
  const now = new Date();
  // M2-2.1: load the tenant severity matrix (falls back to the domain default).
  const severityMatrix = await loadSeverityMatrix(client, tx.tenantId);
  const raised = buildRaised({
    ref,
    body: tx.body,
    loginId: tx.auth.loginId,
    reportedByPersonId: people.reportedByPersonId,
    now,
    criticality: machine.criticality as domain.Criticality | null,
    severityMatrix,
  });
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now,
  });
  const extras = buildRaiseExtras(
    machine.snapshot,
    tx.body,
    machine.criticality as domain.Criticality | null,
    severityMatrix,
  );
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
  });
  const outcome: Outcome = {
    status: 201,
    body: { ticket: { ...tm.ticketProjection(raised.ticket, extras), ...parts } },
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
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, ['raise', parsed.data]);
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
  const openRows = await withTenant(pool, ctx.tenantId, (client) =>
    openTicketRows(client, ctx.tenantId),
  );
  const needReport = await listNeedReport(pool, ctx.tenantId, ctx.personId, ctx.role);
  const open = await withTenant(pool, ctx.tenantId, (client) =>
    withTicketParts(client, ctx.tenantId, openRows, (row) => projectTicket(row)),
  );
  reply.send({ open, needReport, now: new Date().toISOString() });
}

export function registerTickets(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.post('/api/v1/tickets', (request, reply) => raise(pool, request, reply, config.jobBoss));
  registerPast(app, config);
  app.get('/api/v1/tickets', (request, reply) => listTickets(pool, request, reply));
  app.get('/api/v1/state', (request, reply) => state(pool, request, reply));
  app.get('/api/v1/tickets/:id', (request, reply) => detail(pool, request, reply));
  for (const action of Object.keys(COMMAND_SCHEMAS) as tm.CommandAction[]) {
    app.post(`/api/v1/tickets/:id/${action}`, (request, reply) =>
      runCommand(config, request, reply, action),
    );
  }
}
