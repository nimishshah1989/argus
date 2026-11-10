import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import * as shared from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { requireAuth } from './auth.js';
import type { AppConfig } from './config.js';
import * as tm from './ticket-mapper.js';
import * as sql from './ticket-sql.js';
import * as idem from './ticket-idempotency.js';
import { listTickets } from './ticket-list.js';
import * as report from './ticket-report.js';

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

function idempotencyKey(headers: FastifyRequest['headers']): string | null {
  const value = headers['idempotency-key'];
  const key = Array.isArray(value) ? value[0] : value;
  return key && key.trim() ? key.trim() : null;
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

async function executeCommand(client: PoolClient, tx: tm.Tx): Promise<Outcome> {
  const existing = await idem.getIdempotent(client, tx.tenantId, tx.key);
  if (existing) return existing;
  const acting = await resolveActingPerson(client, tx);
  if ('status' in acting) return acting;
  tx.actingPersonId = acting.personId;

  const denied = tm.gatePermission(tx.action, tx, tx.actingPersonId);
  if (denied) return denied;
  const loaded = await loadTicketContext(client, tx);
  if (!loaded) return { status: 404, body: shared.apiError('not_found', 'Unknown ticket') };

  const command = tm.buildCommand(tx, tx.actingPersonId ?? '', loaded);
  const result = tm.applyTransition(tx, tx.actingPersonId, loaded, command);
  if ('status' in result) return result;
  await sql.persistResult(client, tx, loaded, result);
  await report.storeReportForTransition(client, tx, result);

  const outcome: Outcome = {
    status: 200,
    body: { ticket: tm.ticketProjection(result.ticket, loaded.extras) },
  };
  await idem.storeIdempotent(client, tx.tenantId, tx.key, { command: tx.action, result: outcome });
  return outcome;
}

async function runOutcome(
  pool: Pool,
  tenantId: string,
  key: string,
  run: (client: PoolClient) => Promise<Outcome>,
): Promise<Outcome> {
  try {
    return await withTenant(pool, tenantId, run);
  } catch (error) {
    if (error instanceof report.ReportValidationError) {
      return { status: 422, body: shared.apiError('validation', 'Invalid report', error.field) };
    }
    if (!idem.isUniqueViolation(error)) throw error;
    const stored = await withTenant(pool, tenantId, (client) =>
      idem.getIdempotent(client, tenantId, key),
    );
    return stored ?? { status: 500, body: shared.apiError('internal', 'Internal error') };
  }
}

async function runCommand(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  action: tm.CommandAction,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = idempotencyKey(request.headers);
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
  const tx: tm.Tx = {
    tenantId: ctx.tenantId,
    ticketId: (request.params as { id: string }).id,
    key,
    action,
    body: parsed.data as Record<string, unknown>,
    auth: ctx,
    actingPersonId: null,
  };
  const outcome = await runOutcome(pool, tx.tenantId, tx.key, (client) =>
    executeCommand(client, tx),
  );
  reply.code(outcome.status).send(outcome.body);
}

async function validateMachine(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ snapshot: Record<string, unknown> } | Outcome> {
  if (!tx.body.machineId) return { snapshot: {} };
  const machine = (
    await client.query(
      'SELECT id, code, category, cell FROM machine WHERE id = $1 AND tenant_id = $2',
      [tx.body.machineId, tx.tenantId],
    )
  ).rows[0];
  if (!machine)
    return { status: 404, body: shared.apiError('not_found', 'Unknown machine', 'machineId') };
  const duplicate = (
    await client.query(
      "SELECT id FROM ticket WHERE tenant_id = $1 AND machine_id = $2 AND kind <> 'general' AND status NOT IN ('closed', 'cancelled') LIMIT 1",
      [tx.tenantId, tx.body.machineId],
    )
  ).rows[0];
  if (duplicate)
    return { status: 409, body: shared.apiError('conflict', 'Already reported', 'machineId') };
  return { snapshot: { code: machine.code, category: machine.category, cell: machine.cell } };
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

function buildRaised(ref: string, tx: RaiseTx, reportedByPersonId: string | null, now: Date) {
  const startNow = (tx.body.startNow as boolean | undefined) ?? false;
  const selfStarted = Boolean(
    startNow && ((tx.body.startByPersonId as string) || reportedByPersonId),
  );
  return domain.raiseTicket({
    id: randomUUID(),
    ref,
    kind: tx.body.kind as domain.Ticket['kind'],
    machineId: (tx.body.machineId as string | undefined) ?? null,
    problem: tx.body.problem as string,
    reportedAt: now,
    raisedLoginId: tx.auth.loginId,
    reportedByPersonId,
    selfStarted,
    startNow,
    startByPersonId: tx.body.startByPersonId as string | undefined,
  });
}

function raiseExtras(
  snapshot: Record<string, unknown>,
  body: Record<string, unknown>,
): tm.TicketExtras {
  return {
    machineSnapshot: snapshot,
    location: (body.location as string | undefined) ?? null,
    workType: (body.workType as string | undefined) ?? null,
    urgent: (body.urgent as boolean | undefined) ?? false,
    problemLang: (body.problemLang as string | undefined) ?? null,
    reportedByRole: (body.reportedByRole as string | undefined) ?? null,
    raisedChannel: 'floor',
    parentId: null,
    expectedBackAt: null,
    waitingSpare: null,
  };
}

async function executeRaise(client: PoolClient, tx: RaiseTx): Promise<Outcome> {
  const existing = await idem.getIdempotent(client, tx.tenantId, tx.key);
  if (existing) return existing;
  const machine = await validateMachine(client, tx);
  if ('status' in machine) return machine;
  const people = await validateRaisePeople(client, tx);
  if ('status' in people) return people;

  const ref = await sql.allocateRef(client, tx.tenantId);
  const now = new Date();
  const raised = buildRaised(ref, tx, people.reportedByPersonId, now);
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now,
  });
  const extras = raiseExtras(machine.snapshot, tx.body);
  await sql.insertTicket(client, tx.tenantId, raised.ticket, extras);
  await sql.persistEvents(client, tx.tenantId, raised.ticket.id, {
    events: raised.events,
    startSeq: 0,
    idempotencyKey: tx.key,
    loginId: tx.auth.loginId,
    actingPersonId: tx.auth.personId,
    textFor: () => tx.body.problem as string,
  });
  await sql.persistSegments(client, tx.tenantId, raised.ticket.id, raised.segments);

  const outcome: Outcome = {
    status: 201,
    body: { ticket: tm.ticketProjection(raised.ticket, extras) },
  };
  await idem.storeIdempotent(client, tx.tenantId, tx.key, { command: 'raise', result: outcome });
  return outcome;
}

async function raise(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = idempotencyKey(request.headers);
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
  const tx: RaiseTx = {
    tenantId: ctx.tenantId,
    key,
    auth: ctx,
    body: parsed.data as Record<string, unknown>,
  };
  const outcome = await runOutcome(pool, ctx.tenantId, key, (client) => executeRaise(client, tx));
  reply.code(outcome.status).send(outcome.body);
}

async function state(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const rows = await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      `SELECT ${sql.TICKET_COLUMNS} FROM ticket WHERE tenant_id = $1 AND status IN ('open', 'working', 'waiting') ORDER BY reported_at DESC`,
      [ctx.tenantId],
    ),
  );
  const open = rows.rows.map((row) => {
    const ticket = tm.rowToTicket(row as Record<string, unknown>);
    ticket.figures = tm.figuresFromRow(row as Record<string, unknown>);
    return tm.ticketProjection(ticket, tm.rowExtras(row as Record<string, unknown>));
  });
  reply.send({ open, now: new Date().toISOString() });
}

async function detail(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const ticketId = (request.params as { id: string }).id;
  const payload = await withTenant(pool, ctx.tenantId, async (client) => {
    const row = (
      await client.query(
        `SELECT ${sql.TICKET_COLUMNS} FROM ticket WHERE id = $1 AND tenant_id = $2`,
        [ticketId, ctx.tenantId],
      )
    ).rows[0];
    if (!row) return null;
    const ticket = tm.rowToTicket(row as Record<string, unknown>);
    const events = await sql.loadEvents(client, ticketId);
    const segments = await sql.loadSegments(client, ticketId);
    const crew = await sql.loadCrew(client, ticketId);
    ticket.figures = tm.recomputeFigures(ticket, events, segments, {
      overrides: (row.overrides as Record<string, unknown>) ?? {},
      now: new Date(),
    });
    return {
      ticket: tm.ticketProjection(ticket, tm.rowExtras(row as Record<string, unknown>)),
      events: events.map((event) => ({
        seq: event.seq,
        type: event.type,
        at: event.at,
        text: event.text,
        reason: event.reason ?? null,
        isVendor: event.isVendor ?? false,
        actingPersonId: event.actingPersonId,
        loginId: event.loginId,
      })),
      people: crew.map((member: domain.CrewMember) => ({
        personId: member.personId,
        role: member.role,
        leftAt: member.leftAt ?? null,
        leftReason: member.leftReason ?? null,
      })),
      tasks: [],
      intervals: segments.map((segment: domain.WorkSegment) => ({
        personId: segment.personId,
        role: segment.role,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt ?? null,
      })),
      report: await report.loadReport(client, ticketId),
    };
  });
  if (!payload) {
    reply.code(404).send(shared.apiError('not_found', 'Unknown ticket'));
    return;
  }
  reply.send(payload);
}

export function registerTickets(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.post('/api/v1/tickets', (request, reply) => raise(pool, request, reply));
  app.get('/api/v1/tickets', (request, reply) => listTickets(pool, request, reply));
  app.get('/api/v1/state', (request, reply) => state(pool, request, reply));
  app.get('/api/v1/tickets/:id', (request, reply) => detail(pool, request, reply));
  for (const action of Object.keys(COMMAND_SCHEMAS) as tm.CommandAction[]) {
    app.post(`/api/v1/tickets/:id/${action}`, (request, reply) =>
      runCommand(pool, request, reply, action),
    );
  }
}
