import type { PoolClient } from 'pg';
import { SlaInputError } from '@uptimo/domain';
import { activePerson } from '../../identity/index.js';
import { listItem } from '../../plant/index.js';
import {
  nextRef,
  type CrewMember,
  type Figures,
  type Ticket,
  type TicketEvent,
  type WorkSegment,
} from '@uptimo/domain';
import {
  commandExtras,
  recomputeFigures,
  type LoadedCtx,
  type PersistEventsOptions,
  type RaiseExtras,
  type Tx,
} from '../mapper.js';
import { endReasonFor, persistSegments } from './segments.js';

export const TICKET_COLUMNS = `id, ref, kind, status, machine_id, machine_snapshot, location,
  work_type, urgent, problem, problem_lang, reported_at, reported_by_person_id, reported_by_role,
  raised_login_id, raised_channel, self_started, started_at, lead_person_id, segment_started_at,
  handed_over, handover_since, transfer_to_person_id, transfer_to_shift, transfers, wait_reason,
  wait_since, assigned_to_person_id, expected_back_at, waiting_spare, machine_running_at,
  machine_stopped_at, closed_at, closed_by_person_id, close_kind, close_note, cancelled_at, parent_id,
  task_reason, task_expected_on::text AS task_expected_on, task_down_min, severity, criticality_snapshot,
  sla_policy_id, kind_upgraded_at, last_event_seq, response_min, active_min, wait_min, vendor_min, handover_wait_min,
  down_acc_min, downtime_min, follow_min, repair_min, overrides`;

const UPDATE_TICKET_SQL = `UPDATE ticket SET
  ref = $1, kind = $2, status = $3, machine_id = $4, problem = $5, reported_at = $6,
  raised_login_id = $7, reported_by_person_id = $8, self_started = $9, started_at = $10,
  lead_person_id = $11, segment_started_at = $12, handed_over = $13, handover_since = $14,
  transfer_to_person_id = $15, transfer_to_shift = $16, transfers = $17, wait_reason = $18,
  wait_since = $19, assigned_to_person_id = $20, machine_running_at = $21, machine_stopped_at = $22,
  closed_at = $23, closed_by_person_id = $24, close_kind = $25, close_note = $26,
  task_reason = $27, task_expected_on = $28, task_down_min = $29, severity = $30, criticality_snapshot = $31,
  kind_upgraded_at = $32, last_event_seq = $33, response_min = $34, active_min = $35, wait_min = $36,
  vendor_min = $37, handover_wait_min = $38, down_acc_min = $39, downtime_min = $40, follow_min = $41,
  repair_min = $42, expected_back_at = COALESCE($43, expected_back_at), waiting_spare = COALESCE($44, waiting_spare),
  cancelled_at = $45, sla_policy_id = $46, updated_at = now() WHERE id = $47`;

const INSERT_TICKET_SQL = `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id,
  machine_snapshot, location, work_type, urgent, problem, problem_lang, reported_at,
  reported_by_person_id, reported_by_role, raised_login_id, self_started, started_at,
  lead_person_id, segment_started_at, severity, criticality_snapshot, sla_policy_id, last_event_seq,
  response_min, active_min, wait_min, vendor_min, handover_wait_min, down_acc_min,
  downtime_min, follow_min, repair_min)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
    $25,$26,$27,$28,$29,$30,$31,$32,$33) RETURNING id`;

function ticketValues(ticket: Ticket): unknown[] {
  const f = ticket.figures as Figures;
  return [
    ticket.ref,
    ticket.kind,
    ticket.status,
    ticket.machineId,
    ticket.problem,
    ticket.reportedAt,
    ticket.raisedLoginId,
    ticket.reportedByPersonId,
    ticket.selfStarted,
    ticket.startedAt,
    ticket.leadPersonId,
    ticket.segmentStartedAt,
    ticket.handedOver,
    ticket.handoverSince,
    ticket.transferToPersonId,
    ticket.transferToShift,
    ticket.transfers,
    ticket.waitReason,
    ticket.waitSince,
    ticket.assignedToPersonId,
    ticket.machineRunningAt,
    ticket.machineStoppedAt,
    ticket.closedAt,
    ticket.closedByPersonId,
    ticket.closeKind,
    ticket.closeNote,
    ticket.taskReason,
    ticket.taskExpectedOn,
    ticket.taskDownMin,
    ticket.severity,
    ticket.criticalitySnapshot,
    ticket.kindUpgradedAt,
    ticket.lastEventSeq,
    f.responseMin,
    f.activeMin,
    f.waitMin,
    f.vendorMin,
    f.handoverWaitMin,
    f.downAccMin,
    f.downtimeMin,
    f.followMin,
    f.repairMin,
  ];
}

export async function loadTicketRow(
  client: PoolClient,
  ticketId: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const result = await client.query(
    `SELECT ${TICKET_COLUMNS} FROM ticket WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
    [ticketId, tenantId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

export { loadEvents, reviveCorrection } from './events.js';
export { endReasonFor, loadSegments, persistSegments, type SegmentEndReason } from './segments.js';

export async function loadCrew(client: PoolClient, ticketId: string): Promise<CrewMember[]> {
  const result = await client.query(
    `SELECT person_id, role, left_at, left_reason FROM crew_member
       WHERE ticket_id = $1 ORDER BY joined_at`,
    [ticketId],
  );
  return result.rows.map((row) => ({
    personId: row.person_id as string,
    role: row.role as CrewMember['role'],
    ...(row.left_at ? { leftAt: new Date(row.left_at as string | number | Date) } : {}),
    ...(row.left_reason ? { leftReason: row.left_reason as string } : {}),
  }));
}

export async function persistTicket(
  client: PoolClient,
  ticket: Ticket,
  extra: { expectedBackAt?: Date | null; waitingSpare?: string | null } = {},
): Promise<void> {
  const { expectedBackAt = null, waitingSpare = null } = extra;
  await client.query(UPDATE_TICKET_SQL, [
    ...ticketValues(ticket),
    expectedBackAt,
    waitingSpare,
    ticket.cancelledAt ?? null,
    ticket.slaPolicyId ?? null,
    ticket.id,
  ]);
}

export async function insertTicket(
  client: PoolClient,
  tenantId: string,
  ticket: Ticket,
  extras: RaiseExtras,
): Promise<string> {
  const f = ticket.figures as Figures;
  const result = await client.query(INSERT_TICKET_SQL, [
    ticket.id,
    tenantId,
    ticket.ref,
    ticket.kind,
    ticket.status,
    ticket.machineId,
    JSON.stringify(extras.machineSnapshot),
    extras.location,
    extras.workType,
    extras.urgent,
    ticket.problem,
    extras.problemLang,
    ticket.reportedAt,
    ticket.reportedByPersonId,
    extras.reportedByRole,
    ticket.raisedLoginId,
    ticket.selfStarted,
    ticket.startedAt,
    ticket.leadPersonId,
    ticket.segmentStartedAt,
    extras.severity,
    extras.criticalitySnapshot,
    ticket.slaPolicyId ?? null,
    ticket.lastEventSeq,
    f.responseMin,
    f.activeMin,
    f.waitMin,
    f.vendorMin,
    f.handoverWaitMin,
    f.downAccMin,
    f.downtimeMin,
    f.followMin,
    f.repairMin,
  ]);
  return result.rows[0].id as string;
}

export async function persistEvents(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  opts: PersistEventsOptions,
): Promise<void> {
  for (let index = 0; index < opts.events.length; index += 1) {
    const event = opts.events[index] as TicketEvent;
    const text = opts.textFor ? opts.textFor(event, index) : (event.reason ?? null);
    const payload = opts.payloadFor ? opts.payloadFor(event, index) : {};
    await client.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, idempotency_key, at, login_id, acting_person_id, text, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId,
        ticketId,
        opts.startSeq + index,
        event.type,
        // one key per request, one event row per key: a command that writes several events numbers the rest
        index === 0 ? opts.idempotencyKey : `${opts.idempotencyKey}#${index}`,
        event.at,
        opts.loginId,
        opts.actingPersonId,
        text,
        JSON.stringify({
          reason: event.reason ?? null,
          isVendor: event.isVendor ?? false,
          pausesSla: event.pausesSla,
          ...payload,
        }),
      ],
    );
  }
}

export async function persistCrew(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  opts: { crew: CrewMember[]; at: Date },
): Promise<void> {
  const existing = await client.query(
    'SELECT person_id, role, left_at FROM crew_member WHERE ticket_id = $1',
    [ticketId],
  );
  const active = new Set(
    existing.rows.filter((row) => row.left_at == null).map((row) => `${row.person_id}:${row.role}`),
  );
  for (const member of opts.crew) {
    const key = `${member.personId}:${member.role}`;
    if (member.leftAt) {
      if (active.has(key)) {
        await client.query(
          `UPDATE crew_member SET left_at = $1, left_reason = $2, updated_at = now()
             WHERE ticket_id = $3 AND person_id = $4 AND role = $5 AND left_at IS NULL`,
          [member.leftAt, member.leftReason ?? null, ticketId, member.personId, member.role],
        );
        active.delete(key);
      }
    } else if (!active.has(key)) {
      await client.query(
        `INSERT INTO crew_member (tenant_id, ticket_id, person_id, role, joined_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, ticketId, member.personId, member.role, opts.at],
      );
      active.add(key);
    }
  }
}

export async function persistResult(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
  result: { ticket: Ticket; events: TicketEvent[]; segments: WorkSegment[]; crew: CrewMember[] },
): Promise<void> {
  if (tx.action === 'pause') {
    const last = result.events[result.events.length - 1] as TicketEvent;
    const flags = await waitReasonSlaFlags(client, tx.body.reasonCode as string, tx.tenantId);
    last.isVendor = flags.isVendor;
    last.pausesSla = flags.pausesSla;
  }
  result.ticket.figures = recomputeFigures(result.ticket, result.events, result.segments, {
    overrides: (loaded.row.overrides as Record<string, unknown>) ?? {},
    now: new Date(),
  });
  const newEvents = result.events.slice(loaded.events.length);
  await persistTicket(client, result.ticket, commandExtras(tx.action, tx.body));
  await persistEvents(client, tx.tenantId, tx.ticketId, {
    events: newEvents,
    startSeq: loaded.ticket.lastEventSeq + 1,
    idempotencyKey: tx.key,
    loginId: tx.auth.loginId,
    actingPersonId: tx.actingPersonId,
    textFor: tx.action === 'pause' ? () => tx.body.note as string | null : undefined,
    payloadFor:
      tx.action === 'cancel' ? () => ({ previousStatus: loaded.ticket.status }) : undefined,
  });
  await persistSegments(client, tx.tenantId, tx.ticketId, {
    segments: result.segments,
    endReason: endReasonFor(tx.action),
  });
  await persistCrew(client, tx.tenantId, tx.ticketId, {
    crew: result.crew,
    at: newEvents[0]?.at ?? new Date(),
  });
}

export async function personExists(
  client: PoolClient,
  tenantId: string,
  personId: string,
): Promise<boolean> {
  return Boolean(await activePerson(client, tenantId, personId));
}

export async function lockRefCounter(
  client: PoolClient,
  tenantId: string,
  prefix: 'BD' | 'WR',
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `ref-counter:${tenantId}:${prefix}`,
  ]);
}

export async function allocateRef(client: PoolClient, tenantId: string): Promise<string> {
  await lockRefCounter(client, tenantId, 'BD');
  const counter = (
    await client.query(
      "SELECT next_value FROM ref_counter WHERE tenant_id = $1 AND prefix = 'BD' FOR UPDATE",
      [tenantId],
    )
  ).rows[0];
  const next = counter ? Number(counter.next_value) : 1;
  if (next > 2_147_483_646) throw new Error('BD reference counter is exhausted');
  await client.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', $2) ON CONFLICT (tenant_id, prefix) DO UPDATE SET next_value = $2",
    [tenantId, next + 1],
  );
  return nextRef('BD', next);
}

export async function waitReasonSlaFlags(
  client: PoolClient,
  reasonCode: string,
  tenantId: string,
): Promise<{ isVendor: boolean; pausesSla: boolean }> {
  const row = await listItem(client, tenantId, 'wait_reason', reasonCode);
  if (!row) throw new SlaInputError('missing_pause_flag', `Unknown wait reason: ${reasonCode}`);
  return { isVendor: row.is_vendor === true, pausesSla: row.pauses_sla === true };
}
