import type { PoolClient } from 'pg';
import { insertReports } from './insert-reports.js';
import { normalizeCode, normalizeKey } from './json.js';
import { reconcileTicket, type ReconcileReferences } from './reconcile.js';
import { loadTicketReferences } from './references.js';
import type { AliasConfig, BhavinTicket, ImportIssue } from './schema.js';
import type { ImportCtx } from './batch.js';

const TICKET_COLUMNS = [
  'tenant_id',
  'ref',
  'kind',
  'status',
  'machine_id',
  'machine_snapshot',
  'location',
  'work_type',
  'urgent',
  'problem',
  'problem_lang',
  'reported_at',
  'reported_by_person_id',
  'reported_by_role',
  'raised_login_id',
  'raised_channel',
  'self_started',
  'started_at',
  'lead_person_id',
  'segment_started_at',
  'handed_over',
  'handover_since',
  'transfer_to_person_id',
  'transfer_to_shift',
  'transfers',
  'wait_reason',
  'wait_since',
  'paused_by_person_id',
  'assigned_to_person_id',
  'expected_back_at',
  'waiting_spare',
  'machine_running_at',
  'machine_stopped_at',
  'closed_at',
  'closed_by_person_id',
  'close_kind',
  'close_note',
  'cancelled_at',
  'kind_upgraded_at',
  'last_event_seq',
  'response_min',
  'active_min',
  'wait_min',
  'vendor_min',
  'handover_wait_min',
  'down_acc_min',
  'downtime_min',
  'follow_min',
  'repair_min',
  'overrides',
  'edited_at',
] as const;

function person(refs: ReconcileReferences, name: string | null): string | null {
  if (name === null) return null;
  const id = refs.people.get(normalizeKey(name));
  if (!id) throw new Error(`Unresolved person: ${name}`);
  return id;
}

function canonical(
  map: ReadonlyMap<string, { code: string }>,
  value: string | null,
): string | null {
  if (value === null) return null;
  const code = map.get(normalizeCode(value))?.code;
  if (!code) throw new Error(`Unresolved reference code: ${value}`);
  return code;
}

function baseValues(ticket: BhavinTicket, refs: ReconcileReferences): unknown[] {
  return [
    ticket.ref,
    ticket.kind,
    ticket.status,
    refs.machine?.id ?? null,
    JSON.stringify(refs.machine ?? {}),
    canonical(refs.locations, ticket.location),
    canonical(refs.workTypes, ticket.workType),
    false,
    ticket.problem,
    null,
    ticket.reportedAt,
    person(refs, ticket.reportedByPerson),
    null,
    null,
    ticket.entryType === 'pastBreakdown' ? 'backfill' : 'import',
  ];
}

function stateValues(ticket: BhavinTicket, refs: ReconcileReferences): unknown[] {
  const state = ticket.state;
  return [
    state.selfStarted,
    state.startedAt,
    person(refs, state.leadPerson),
    state.segmentStartedAt,
    state.handedOver,
    state.handoverSince,
    person(refs, state.transferToPerson),
    state.transferToShift,
    state.transfers,
    state.waitReason,
    state.waitSince,
    person(refs, state.pausedByPerson),
    person(refs, state.assignedToPerson),
    state.expectedBackAt,
    state.waitingSpare,
    state.machineRunningAt,
    state.machineStoppedAt,
    state.closedAt,
    person(refs, state.closedByPerson),
    state.closeKind,
    state.closeNote,
    state.cancelledAt,
    state.kindUpgradedAt,
    ticket.events.length - 1,
  ];
}

function figureValues(reconciled: ReturnType<typeof reconcileTicket>): unknown[] {
  const figures = reconciled.figureResult.figures;
  return [
    figures.responseMin,
    figures.activeMin,
    figures.waitMin,
    figures.vendorMin,
    figures.handoverWaitMin,
    figures.downAccMin,
    figures.downtimeMin,
    figures.followMin,
    figures.repairMin,
    JSON.stringify(reconciled.figureResult.overrides),
    reconciled.reduced.editedAt,
  ];
}

async function insertTicketRow(
  ctx: ImportCtx,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
  reconciled: ReturnType<typeof reconcileTicket>,
): Promise<string> {
  const reduced = reconciled.reduced;
  const state = { ...ticket.state, ...reduced.state };
  const projected = { ...ticket, problem: reduced.problem, reportedAt: reduced.reportedAt, state };
  const values = [
    ctx.tenantId,
    ...baseValues(projected, refs),
    ...stateValues(projected, refs),
    ...figureValues(reconciled),
  ];
  const placeholders = TICKET_COLUMNS.map((_, index) => `$${index + 1}`).join(',');
  const result = await ctx.client.query(
    `INSERT INTO ticket (${TICKET_COLUMNS.join(',')}) VALUES (${placeholders}) RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
}

async function insertEvents(
  ctx: ImportCtx,
  ticketId: string,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
): Promise<void> {
  for (const [seq, event] of ticket.events.entries()) {
    await ctx.client.query(
      `INSERT INTO ticket_event (
         tenant_id, ticket_id, seq, type, idempotency_key, at, login_id, acting_person_id, text, payload
       ) VALUES ($1,$2,$3,$4,NULL,$5,NULL,$6,$7,$8)`,
      [
        ctx.tenantId,
        ticketId,
        seq,
        event.type,
        event.at,
        person(refs, event.by),
        event.text,
        JSON.stringify(event.payload),
      ],
    );
  }
}

async function insertCrew(
  ctx: ImportCtx,
  ticketId: string,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
): Promise<void> {
  for (const member of ticket.crew) {
    await ctx.client.query(
      `INSERT INTO crew_member (
         tenant_id, ticket_id, person_id, role, joined_at, left_at, left_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ctx.tenantId,
        ticketId,
        person(refs, member.person),
        member.role === 'lead' ? 'primary' : member.role,
        member.joinedAt,
        member.leftAt,
        member.leftReason,
      ],
    );
  }
}

async function insertSegments(
  ctx: ImportCtx,
  ticketId: string,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
): Promise<void> {
  for (const segment of ticket.segments) {
    await ctx.client.query(
      `INSERT INTO work_segment (
         tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ctx.tenantId,
        ticketId,
        person(refs, segment.person),
        segment.role,
        segment.startedAt,
        segment.endedAt,
        segment.endReason,
      ],
    );
  }
}

export async function importTicket(
  client: PoolClient,
  tenantId: string,
  ticket: BhavinTicket,
  context: { aliases: AliasConfig; now: Date },
): Promise<{
  ticketId: string;
  events: number;
  crew: number;
  segments: number;
  reports: number;
  reportPeople: number;
  pendingPersons: string[];
  issues: ImportIssue[];
  exactMatches: number;
  toleratedMismatches: number;
}> {
  const ctx = { client, tenantId };
  const refs = await loadTicketReferences(ctx, ticket, context.aliases);
  const reconciled = reconcileTicket(ticket, refs, context.now);
  const ticketId = await insertTicketRow(ctx, ticket, refs, reconciled);
  await insertEvents(ctx, ticketId, ticket, refs);
  await insertCrew(ctx, ticketId, ticket, refs);
  await insertSegments(ctx, ticketId, ticket, refs);
  const reports = await insertReports(ctx, ticketId, reconciled.reports);
  return {
    ticketId,
    events: ticket.events.length,
    crew: ticket.crew.length,
    segments: ticket.segments.length,
    ...reports,
    pendingPersons: reconciled.pendingPersons.map((pending) => pending.name),
    issues: reconciled.figureResult.issues,
    exactMatches:
      9 +
      reconciled.reports.length * 3 -
      reconciled.figureResult.issues.filter((issue) => issue.code.startsWith('figure_')).length,
    toleratedMismatches: reconciled.figureResult.issues.filter(
      (issue) => issue.severity === 'warning',
    ).length,
  };
}
