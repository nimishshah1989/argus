import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import * as shared from '@uptimo/shared';
import { canLateReport, recordPastBreakdown, type Ticket } from '@uptimo/domain';
import { ticketPartsAfterWrite, type AppConfig } from '../../kernel/index.js';
import { requireAuth, peopleByIds, tenantInfo } from '../identity/index.js';
import { machinesByIds, shiftCodeAt, actorOf, type MachineRow } from '../plant/index.js';
import { audit } from '../ops/index.js';
import { importTickets, type ImportedTicketRow } from './import.js';
import { runOutcome } from './outcome.js';
import { projectTicket } from './list.js';
import * as tm from './mapper.js';
import * as idem from './repo/idempotency.js';
import { overlappingBreakdownId, ticketRowById } from './repo/list.js';
import { plantDateAt } from './repo/report.js';
import { allocateRef, lockRefCounter } from './repo/ticket.js';

type Outcome = tm.Outcome;
type Auth = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
type Report = NonNullable<ImportedTicketRow['report']>;

interface PastTx {
  tenantId: string;
  auth: Auth;
  body: shared.PastBreakdownBody;
  now: Date;
}

const refuse = (
  status: number,
  code: shared.ErrorCode,
  message: string,
  field: string,
): Outcome => ({
  status,
  body: shared.apiError(code, message, field),
});

/** Times the form can get wrong before the database is asked anything: none may be in the future. */
function timeProblem(body: shared.PastBreakdownBody, now: Date): Outcome | null {
  const times: Array<[field: string, at: Date | undefined]> = [
    ['reportedAt', body.reportedAt],
    ['workStartedAt', body.workStartedAt],
    ['runningAt', body.runningAt],
  ];
  const future = times.find(([, at]) => at && at > now);
  return future ? refuse(422, 'validation', 'That time is in the future', future[0]) : null;
}

async function unknownPerson(client: PoolClient, tx: PastTx): Promise<Outcome | null> {
  const { body } = tx;
  const named: Array<[field: string, id: string | undefined]> = [
    ['reportedByPersonId', body.reportedByPersonId],
    ['closedByPersonId', body.closedByPersonId],
    ...(body.report?.doneByPersonIds ?? []).map((id): [string, string] => [
      'report.doneByPersonIds',
      id,
    ]),
    ...(body.report?.supportedByPersonIds ?? []).map((id): [string, string] => [
      'report.supportedByPersonIds',
      id,
    ]),
  ];
  const ids = [...new Set(named.flatMap(([, id]) => (id ? [id] : [])))];
  if (ids.length === 0) return null;
  const found = new Set((await peopleByIds(client, tx.tenantId, ids)).map((p) => p.id));
  const missing = named.find(([, id]) => id && !found.has(id));
  return missing ? refuse(404, 'not_found', 'Unknown person', missing[0]) : null;
}

const NO_REPORT_FIELDS = {
  observedBy: null,
  correctiveAction: null,
  breakdownCategory: null,
  maintCode: null,
  spareUsed: null,
  rootCause: null,
  handoverName: null,
  doneByPersonIds: [],
  supportedByPersonIds: [],
};

/** The shift the stop fell in (or the one the form names), asked before anything is written. */
async function shiftFor(client: PoolClient, tx: PastTx): Promise<string | Outcome> {
  const { body } = tx;
  if (body.report?.shiftCode) return body.report.shiftCode;
  const zone = (await tenantInfo(client, tx.tenantId)).time_zone;
  const found = await shiftCodeAt(client, zone, body.reportedAt);
  return found ?? refuse(422, 'validation', 'No shift covers that time', 'report.shiftCode');
}

/** The report as the plant files it: the form's fields, then the shift and date the stop fell in. */
async function reportFor(
  client: PoolClient,
  tx: PastTx,
  filed: { figures: ImportedTicketRow['figures']; shiftCode: string },
): Promise<Report> {
  const { body } = tx;
  const { figures, shiftCode } = filed;
  const form = body.report ?? {};
  return {
    ...NO_REPORT_FIELDS,
    ...form,
    date: form.date ?? (await plantDateAt(client, tx.tenantId, body.reportedAt)),
    shiftCode,
    problem: form.problem ?? body.problem,
    // the figures already carry any minutes the form entered
    downtimeMin: figures.downtimeMin ?? 0,
    responseMin: figures.responseMin,
    repairMin: figures.repairMin,
    submittedByPersonId: tx.auth.personId,
    submittedAt: tx.now,
  };
}

function closedState(ticket: Ticket, startedAt: Date | null): ImportedTicketRow['state'] {
  return {
    selfStarted: false,
    startedAt,
    leadPersonId: null,
    segmentStartedAt: null,
    handedOver: false,
    handoverSince: null,
    transferToPersonId: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    pausedByPersonId: null,
    assignedToPersonId: null,
    expectedBackAt: null,
    waitingSpare: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    closedAt: ticket.closedAt,
    closedByPersonId: ticket.closedByPersonId,
    closeKind: 'report',
    closeNote: null,
    cancelledAt: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    editedAt: null,
  };
}

function pastRow(
  past: ReturnType<typeof recordPastBreakdown>,
  rest: Pick<
    ImportedTicketRow,
    'machine' | 'raisedLoginId' | 'figures' | 'report' | 'overrides' | 'state'
  >,
): ImportedTicketRow {
  const { ticket, events } = past;
  return {
    ref: ticket.ref,
    kind: 'stopped',
    status: 'closed',
    channel: 'backfill',
    location: null,
    workType: null,
    urgent: false,
    problem: ticket.problem,
    reportedAt: ticket.reportedAt,
    reportedByPersonId: ticket.reportedByPersonId,
    reportedByRole: null,
    // Who entered the record is the caller's login; the person acting is who reported the stop, then who fixed it.
    events: events.map((event) => ({
      type: event.type,
      at: event.at,
      actingPersonId: event.type === 'down' ? ticket.reportedByPersonId : ticket.closedByPersonId,
      text: event.type === 'down' ? ticket.problem : null,
      payload: {},
      loginId: ticket.raisedLoginId,
    })),
    crew: [],
    segments: [],
    ...rest,
  };
}

/** Whatever stops the record being written: an unknown machine or person, or an open breakdown in the way. */
async function refusalFor(
  client: PoolClient,
  tx: PastTx,
  machine: MachineRow | undefined,
): Promise<Outcome | null> {
  if (!machine) return refuse(404, 'not_found', 'Unknown machine', 'machineId');
  const person = await unknownPerson(client, tx);
  if (person) return person;
  const overlap = await overlappingBreakdownId(client, tx.tenantId, {
    machineId: machine.id,
    from: tx.body.reportedAt,
    to: tx.body.runningAt,
  });
  return overlap
    ? refuse(409, 'conflict', 'This overlaps another breakdown of the machine', 'reportedAt')
    : null;
}

const wholeMin = (from: Date, to: Date): number =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

/** The minutes the times give, entered by hand rather than worked out from events; what the form states wins. */
function handEnteredMinutes(body: shared.PastBreakdownBody): Record<string, number> {
  const { reportedAt, workStartedAt, runningAt, report } = body;
  const derived = {
    downtimeMin: wholeMin(reportedAt, runningAt),
    responseMin: workStartedAt && wholeMin(reportedAt, workStartedAt),
    repairMin: workStartedAt && wholeMin(workStartedAt, runningAt),
  };
  const entered = {
    downtimeMin: report?.downtimeMin ?? derived.downtimeMin,
    responseMin: report?.responseMin ?? derived.responseMin,
    repairMin: report?.repairMin ?? derived.repairMin,
  };
  return Object.fromEntries(
    Object.entries(entered).filter(([, minutes]) => minutes !== undefined),
  ) as Record<string, number>;
}

/** The closed ticket, its report and its figures, as `importTickets` writes them. */
async function buildPast(
  client: PoolClient,
  tx: PastTx,
  filed: { machine: MachineRow; shiftCode: string },
): Promise<ImportedTicketRow> {
  const { machine, shiftCode } = filed;
  const { body } = tx;
  const past = recordPastBreakdown({
    id: randomUUID(),
    ref: await allocateRef(client, tx.tenantId, 'stopped'),
    kind: 'stopped',
    machineId: machine.id,
    machineCriticality: machine.criticality,
    problem: body.problem,
    reportedAt: body.reportedAt,
    closedAt: body.runningAt,
    raisedLoginId: tx.auth.loginId,
    reportedByPersonId: body.reportedByPersonId ?? null,
    closedByPersonId: body.closedByPersonId ?? null,
  });
  const overrides = handEnteredMinutes(body);
  const figures = tm.recomputeFigures(past.ticket, past.events, [], { overrides, now: tx.now });
  // No work start, no repair time: the stored figure stays empty rather than a made-up 0.
  const kept = { ...figures, repairMin: overrides.repairMin ?? null };
  const report = await reportFor(client, tx, { figures: kept, shiftCode });
  const { code, category, cell, criticality } = machine;
  return pastRow(past, {
    machine: { id: machine.id, snapshot: { code, category, cell, criticality }, criticality },
    raisedLoginId: tx.auth.loginId,
    figures: kept,
    report,
    overrides,
    state: closedState(past.ticket, body.workStartedAt ?? null),
  });
}

async function executePast(
  client: PoolClient,
  tx: PastTx,
  binding: idem.IdempotencyBinding,
  boss?: PgBoss,
): Promise<Outcome> {
  const { body, tenantId } = tx;
  // The same lock a raise takes, so a breakdown cannot be raised while its overlap is being checked.
  await lockRefCounter(client, tenantId, 'BD');
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  // A switched-off machine is allowed: its history still belongs in the books.
  const machine = (await machinesByIds(client, tenantId, [body.machineId], 'share'))[0];
  const refusal = await refusalFor(client, tx, machine);
  if (refusal) return refusal;
  // Every refusal comes before the first write, so a refused request never uses up a reference number.
  const shiftCode = await shiftFor(client, tx);
  if (typeof shiftCode !== 'string') return shiftCode;
  const row = await buildPast(client, tx, { machine: machine as MachineRow, shiftCode });
  const [ticketId] = (await importTickets(client, tenantId, [row])) as [string];
  await audit.record(client, {
    tenantId,
    loginId: tx.auth.loginId,
    action: 'ticket.past',
    entity: 'ticket',
    entityId: ticketId,
    before: null,
    after: {
      // the people the breakdown names are history; this is who recorded it
      actingPersonId: tx.auth.personId,
      ref: row.ref,
      machineId: body.machineId,
      reportedAt: body.reportedAt.toISOString(),
      workStartedAt: body.workStartedAt?.toISOString() ?? null,
      runningAt: body.runningAt.toISOString(),
    },
  });
  const parts = await ticketPartsAfterWrite(client, {
    tenantId,
    ticketId,
    now: tx.now,
    boss,
    command: 'past',
    actor: tx.auth,
  });
  const stored = await ticketRowById(client, tenantId, ticketId);
  const outcome: Outcome = {
    status: 201,
    body: { ticket: { ...projectTicket(stored), ...parts } },
  };
  await idem.storeIdempotent(client, { ...binding, command: 'past', result: outcome });
  return outcome;
}

async function recordPast(
  config: AppConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(config.pool, request, reply);
  if (!ctx) return;
  if (!canLateReport(actorOf(ctx))) {
    reply
      .code(403)
      .send(shared.apiError('forbidden', 'You do not have permission for this action'));
    return;
  }
  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply
      .code(422)
      .send(
        shared.apiError(
          'validation',
          'Idempotency-Key header is required (keys starting with esc: are reserved)',
          'idempotencyKey',
        ),
      );
    return;
  }
  const parsed = shared.pastBreakdownSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(shared.apiError('validation', 'Invalid breakdown', field || undefined));
    return;
  }
  const now = new Date();
  const late = timeProblem(parsed.data, now);
  if (late) {
    reply.code(late.status).send(late.body);
    return;
  }
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    'past',
    parsed.data,
    idem.phoneActor(ctx),
  ]);
  const tx: PastTx = { tenantId: ctx.tenantId, auth: ctx, body: parsed.data, now };
  const outcome = await runOutcome(config.pool, binding, (client) =>
    executePast(client, tx, binding, config.jobBoss),
  );
  reply.code(outcome.status).send(outcome.body);
}

export function registerPast(app: FastifyInstance, config: AppConfig): void {
  app.post('/api/v1/tickets/past', (request, reply) => recordPast(config, request, reply));
}
