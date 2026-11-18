import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * The machines that already have a PM job open, being worked or waiting (R6's idempotency: one job per plan and
 * period). Database reads only; `pm.generate` owns the decision and the raise.
 */
export async function openPmMachineIds(
  tx: Db,
  tenantId: string,
  machineIds: readonly string[],
): Promise<Set<string>> {
  if (machineIds.length === 0) return new Set();
  const rows = (
    await tx.query(
      `SELECT DISTINCT machine_id FROM ticket
        WHERE tenant_id = $1 AND raised_channel = 'pm'
          AND status IN ('open', 'working', 'waiting') AND machine_id = ANY($2::uuid[])`,
      [tenantId, machineIds],
    )
  ).rows;
  return new Set(rows.map((row) => row.machine_id as string));
}

/**
 * The meter reading of each machine's most recent closed PM job: the baseline R6 measures the plan's
 * `last_meter_reading` against. The most recent report always wins; it carries no numeric `readings.meter`
 * (a non-meter plan, or a report written by hand), the plan has no baseline and the meter rule stays inert.
 */
export async function latestPmReadings(
  tx: Db,
  tenantId: string,
  machineIds: readonly string[],
): Promise<Map<string, number>> {
  const readings = new Map<string, number>();
  if (machineIds.length === 0) return readings;
  const rows = (
    await tx.query(
      `SELECT DISTINCT ON (t.machine_id) t.machine_id,
              CASE WHEN jsonb_typeof(r.pm_report->'readings'->'meter') = 'number'
                   THEN (r.pm_report->'readings'->>'meter')::float8 END AS meter
         FROM ticket t
         JOIN breakdown_report r ON r.tenant_id = t.tenant_id AND r.ticket_id = t.id
        WHERE t.tenant_id = $1 AND t.raised_channel = 'pm' AND t.status = 'closed'
          AND t.machine_id = ANY($2::uuid[])
        ORDER BY t.machine_id, t.closed_at DESC NULLS LAST`,
      [tenantId, machineIds],
    )
  ).rows;
  for (const row of rows)
    if (row.meter !== null) readings.set(row.machine_id as string, Number(row.meter));
  return readings;
}
