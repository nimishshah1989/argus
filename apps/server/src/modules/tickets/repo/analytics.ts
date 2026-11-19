import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

/**
 * Every ticket of the plant with the fields the analytics engines read, in the order they were reported.
 * Cancelled ones are included (the engine decides what counts); no names, notes or phone numbers are read.
 */
export async function ticketsForEngine(tx: Db): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT id, ref, kind, status, machine_id, reported_at, closed_at, raised_channel, downtime_min,
              repair_min, work_type, parent_id, task_reason, task_expected_on::text AS task_expected_on
         FROM ticket ORDER BY reported_at, id`,
    )
  ).rows;
}

/** The breakdown reports, each with the people who did the work and those who supported it. */
export async function reportsForEngine(tx: Db): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT r.id, r.ticket_id, r.machine_id, r.date::text AS date, r.shift_code, r.problem, r.observed_by, r.corrective_action, r.downtime_min,
              r.response_min, r.repair_min, r.breakdown_category, r.maint_code, r.spare_used, r.spare_cost, r.root_cause,
              COALESCE(array_agg(p.person_id ORDER BY p.person_id) FILTER (WHERE p.role = 'done'), '{}') AS done_by,
              COALESCE(array_agg(p.person_id ORDER BY p.person_id) FILTER (WHERE p.role = 'supported'), '{}') AS supported_by
         FROM breakdown_report r LEFT JOIN breakdown_report_person p ON p.report_id = r.id
        GROUP BY r.id ORDER BY r.date, r.id`,
    )
  ).rows;
}

/** A ticket as the engine reads it back: its close state only, never its text or the people on it (52 R12). */
export interface RaisedTicket {
  id: string;
  ref: string;
  status: string;
  closeKind: string | null;
  closedAt: Date | null;
}

/**
 * The ticket whose raise event carries `{source:{<kind>: id}}`, for each id in the batch (52 R16). The link lives on
 * `ticket_event.payload`, the only place the schema keeps it; the read is narrowed to one tenant, `type = 'down'` and
 * the batch's ids, and takes the latest raise of a source key. There is no index on the payload, so this scans the
 * tenant's `down` events: bounded by the batch (at most one id per frozen row a month) and recorded as a follow-up.
 */
export async function raisedTicketsFor(
  tx: Db,
  tenantId: string,
  kind: 'nudge' | 'forecast',
  ids: readonly string[],
): Promise<Map<string, RaisedTicket>> {
  if (ids.length === 0) return new Map();
  const rows = (
    await tx.query(
      `SELECT DISTINCT ON (e.payload->'source'->>$3) e.payload->'source'->>$3 AS source_id,
              t.id, t.ref, t.status, t.close_kind, t.closed_at
         FROM ticket_event e
         JOIN ticket t ON t.tenant_id = e.tenant_id AND t.id = e.ticket_id
        WHERE e.tenant_id = $1 AND e.type = 'down' AND e.payload->'source'->>$3 = ANY($2::text[])
        ORDER BY e.payload->'source'->>$3, e.at DESC`,
      [tenantId, ids, kind],
    )
  ).rows;
  return new Map(
    rows.map((row) => [
      row.source_id as string,
      {
        id: row.id as string,
        ref: row.ref as string,
        status: row.status as string,
        closeKind: (row.close_kind as string | null) ?? null,
        closedAt: (row.closed_at as Date | null) ?? null,
      },
    ]),
  );
}
