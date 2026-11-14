import type { PoolClient, QueryResult } from 'pg';
import { personMinutes, type WorkSegment } from '@uptimo/domain';

type Db = Pick<PoolClient, 'query'>;

const JOBS_SQL = `WITH touched AS (
    SELECT ticket_id FROM work_segment
     WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4
       AND COALESCE(ended_at, $4) > $3
    UNION
    SELECT ticket_id FROM ticket_event
     WHERE tenant_id = $1 AND acting_person_id = $2 AND at >= $3 AND at < $4
  )
  SELECT t.id, t.ref, t.kind, t.status, t.problem, t.machine_snapshot, t.machine_id,
         t.closed_by_person_id
    FROM touched
    JOIN ticket t ON t.id = touched.ticket_id AND t.tenant_id = $1
   ORDER BY t.reported_at, t.ref`;

const DAY_SEGMENTS_SQL = `SELECT ticket_id, person_id, role, started_at, ended_at FROM work_segment
   WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4 AND COALESCE(ended_at, $4) > $3`;

/**
 * Where each ticket stood at `$2`, judged by what had happened by then, from the history: its last close, cancel,
 * restore or sign-off dispute before `$2` says closed, cancelled or pending. (A restore clears `cancelled_at`, and a
 * dispute clears `closed_at`, so the columns alone cannot say.) A ticket with none of those events falls back on its current status and its closing or cancelling time.
 */
const STATE_AT_SQL = `SELECT s.* FROM (
    WITH last_turn AS (
      SELECT DISTINCT ON (ticket_id) ticket_id, type FROM ticket_event
       WHERE tenant_id = $1 AND type IN ('close', 'cancel', 'restore', 'handback_dispute') AND at < $2
       ORDER BY ticket_id, at DESC, seq DESC
    )
    SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.machine_snapshot, t.machine_id,
           CASE WHEN l.type = 'close' THEN 'closed'
                WHEN l.type = 'cancel' THEN 'cancelled'
                WHEN l.type IN ('restore', 'handback_dispute') THEN 'pending'
                WHEN t.status IN ('open', 'working', 'waiting') OR COALESCE(t.closed_at, t.cancelled_at) >= $2
                  THEN 'pending'
                WHEN t.status = 'closed' THEN 'closed'
                ELSE 'cancelled' END AS state_at_end
      FROM ticket t
      LEFT JOIN last_turn l ON l.ticket_id = t.id
     WHERE t.tenant_id = $1 AND t.reported_at < $2
  ) s`;

export type StateAtEnd = 'closed' | 'cancelled' | 'pending';

const isPrimary = (role: string): boolean => role !== 'support';

/**
 * The tickets a person touched in the window, each with that person's minutes inside it (the one domain function),
 * split into primary (lead or primary) and support, the roles they worked, who closed it, and where it stood at the end.
 */
export async function dayJobRows(
  tx: Db,
  input: { tenantId: string; personId: string; start: Date; end: Date },
): Promise<QueryResult['rows']> {
  const { tenantId, personId, start, end } = input;
  const rows = (await tx.query(JOBS_SQL, [tenantId, personId, start, end])).rows;
  const segments = (await tx.query(DAY_SEGMENTS_SQL, [tenantId, personId, start, end])).rows;
  const states = new Map(
    (
      await tx.query(`${STATE_AT_SQL} WHERE s.id = ANY($3::uuid[])`, [
        tenantId,
        end,
        rows.map((row) => row.id),
      ])
    ).rows.map((row) => [row.id as string, row.state_at_end as StateAtEnd]),
  );
  const now = new Date();
  const minutesOf = (own: WorkSegment[]): number =>
    personMinutes(own, now, { start, end })[personId] ?? 0;
  return rows.map((row) => {
    const own = segments
      .filter((s) => s.ticket_id === row.id)
      .map((s) => ({
        personId: s.person_id as string,
        role: s.role as WorkSegment['role'],
        startedAt: new Date(s.started_at as string | number | Date),
        ...(s.ended_at ? { endedAt: new Date(s.ended_at as string | number | Date) } : {}),
      }));
    return {
      ...row,
      minutes: minutesOf(own),
      primary_minutes: minutesOf(own.filter((s) => isPrimary(s.role))),
      support_minutes: minutesOf(own.filter((s) => !isPrimary(s.role))),
      roles: [
        ...(own.some((s) => isPrimary(s.role)) ? ['primary'] : []),
        ...(own.some((s) => !isPrimary(s.role)) ? ['support'] : []),
      ],
      state_at_end: states.get(row.id as string) ?? 'pending',
    };
  });
}

/** Everyone who worked a ticket in the window (a work stretch or an event), whatever their team or whether still active. */
export async function peopleWhoWorked(
  tx: Db,
  input: { tenantId: string; start: Date; end: Date },
): Promise<string[]> {
  const rows = (
    await tx.query(
      `SELECT person_id AS id FROM work_segment
        WHERE tenant_id = $1 AND started_at < $3 AND COALESCE(ended_at, $3) > $2
       UNION
       SELECT acting_person_id FROM ticket_event
        WHERE tenant_id = $1 AND acting_person_id IS NOT NULL AND at >= $2 AND at < $3`,
      [input.tenantId, input.start, input.end],
    )
  ).rows;
  return rows.map((row) => row.id as string);
}

/** The tickets not yet closed or cancelled when the window ended (see `STATE_AT_SQL`). */
export async function pendingRows(
  tx: Db,
  tenantId: string,
  end: Date,
): Promise<QueryResult['rows']> {
  return (
    await tx.query(
      `${STATE_AT_SQL} WHERE s.state_at_end = 'pending' ORDER BY s.reported_at, s.ref`,
      [tenantId, end],
    )
  ).rows;
}

const TICKET_SQL = `SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.closed_at,
    t.machine_snapshot, t.response_min, t.active_min, t.wait_min, t.vendor_min,
    t.handover_wait_min, t.down_acc_min, t.downtime_min, t.follow_min, t.repair_min, t.machine_id,
    t.raised_login_id
  FROM ticket t
  WHERE t.id = $1 AND t.tenant_id = $2`;

export async function pdfTicketRow(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<QueryResult['rows']> {
  return (await tx.query(TICKET_SQL, [ticketId, tenantId])).rows;
}

export interface HistoryRow {
  id: string;
  machineId: string;
  reportedAt: Date;
  problem: string;
  closeNote: string | null;
  action: string | null; // corrective_action of the newest report
  rootCause: string | null;
  spare: string | null;
  code: string | null;
  category: string | null;
}

const MACHINE_HISTORY_SQL = `SELECT t.id, t.machine_id AS "machineId", t.reported_at AS "reportedAt", t.problem,
       t.close_note AS "closeNote", r.corrective_action AS action, r.root_cause AS "rootCause",
       r.spare_used AS spare, r.maint_code AS code, r.breakdown_category AS category
  FROM ticket t
  LEFT JOIN LATERAL (
    SELECT corrective_action, root_cause, spare_used, maint_code, breakdown_category
      FROM breakdown_report br
     WHERE br.tenant_id = t.tenant_id AND br.ticket_id = t.id
     ORDER BY br.submitted_at DESC LIMIT 1) r ON true
 WHERE t.tenant_id = $1 AND t.machine_id = ANY($2::uuid[])
   AND t.status = 'closed' AND t.reported_at < $3
 ORDER BY t.reported_at DESC, t.ref DESC
 LIMIT $4`;

/** Closed past tickets of the given machines, newest first. Names (observed_by, handover_name) are never read. */
export async function machineHistory(
  tx: Db,
  tenantId: string,
  query: { machineIds: readonly string[]; before: Date; limit: number },
): Promise<HistoryRow[]> {
  if (query.machineIds.length === 0) return [];
  return (
    await tx.query(MACHINE_HISTORY_SQL, [tenantId, query.machineIds, query.before, query.limit])
  ).rows;
}

const SEEN_ELSEWHERE_SQL = `SELECT n.note FROM (
  SELECT lower(regexp_replace(btrim(COALESCE(NULLIF(btrim(r.corrective_action), ''), t.close_note)), '\\s+', ' ', 'g')) AS note,
         t.machine_id, (t.reported_at AT TIME ZONE 'UTC')::date AS day
    FROM ticket t
    LEFT JOIN LATERAL (
      SELECT corrective_action FROM breakdown_report br
       WHERE br.tenant_id = t.tenant_id AND br.ticket_id = t.id
       ORDER BY br.submitted_at DESC LIMIT 1) r ON true
   WHERE t.tenant_id = $1 AND t.status = 'closed' AND t.machine_id IS NOT NULL
     AND t.machine_id <> ALL($2::uuid[])
) n
 WHERE n.note = ANY($3::text[])
 GROUP BY n.note, n.day
HAVING count(DISTINCT n.machine_id) >= 3`;

/** Which of the (normalised) notes are stock phrases: the closing note of closed tickets on 3+ machines outside the family on one UTC day. */
export async function notesSeenElsewhere(
  tx: Db,
  tenantId: string,
  query: { notes: readonly string[]; outsideMachineIds: readonly string[] },
): Promise<Set<string>> {
  if (query.notes.length === 0) return new Set();
  const rows = (
    await tx.query(SEEN_ELSEWHERE_SQL, [tenantId, query.outsideMachineIds, query.notes])
  ).rows;
  return new Set(rows.map((r: { note: string }) => r.note));
}
