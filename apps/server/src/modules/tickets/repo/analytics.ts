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
      `SELECT r.id, r.ticket_id, r.machine_id, r.date::text AS date, r.shift_code, r.problem, r.downtime_min,
              r.response_min, r.repair_min, r.breakdown_category, r.maint_code, r.spare_used, r.root_cause,
              COALESCE(array_agg(p.person_id ORDER BY p.person_id) FILTER (WHERE p.role = 'done'), '{}') AS done_by,
              COALESCE(array_agg(p.person_id ORDER BY p.person_id) FILTER (WHERE p.role = 'supported'), '{}') AS supported_by
         FROM breakdown_report r LEFT JOIN breakdown_report_person p ON p.report_id = r.id
        GROUP BY r.id ORDER BY r.date, r.id`,
    )
  ).rows;
}
