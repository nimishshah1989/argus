import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { EngineResult } from '@uptimo/domain';
import { tenantInfo } from '../identity/index.js';

type Db = Pick<PoolClient, 'query'>;

/**
 * Ticket 75a: the figures a plant's readers are served. One run per plant and date is kept as a single
 * `kpi_snapshot` row (profile `served`, key `figures-run`: the whole result, drill ids included, with the stamp of the
 * data it was computed from). No new table; the loader's own reads decide the stamp.
 */
export const SERVED_PROFILE = 'served';
export const SERVED_KEY = 'figures-run';
/** A kept run computed longer ago than this is dropped when a newer one is saved, so a plant keeps about a week of dates. */
const KEEP_DAYS = 7;

/**
 * Every table `loadEngineData` reads, directly or through another module. A change to any of them changes the stamp.
 * `ticket_event` is not listed: each event append also moves `ticket.last_event_seq`, and the loader reads only the
 * why-why lines of it. A guard test lists the tables the loader really queries and fails when one is missing here.
 */
export const STAMPED_TABLES = [
  'person',
  'login',
  'segment',
  'machine',
  'machine_move',
  'shift',
  'ticket',
  'breakdown_report',
  'breakdown_report_person',
  'list_item',
  'pm_plan',
  'asset_register',
  'setting',
] as const;

/**
 * What the data and the code looked like when a run was computed: per table the row count and the newest row
 * version's transaction id (`xmin`), the plant's name and time zone, and the build's commit. An insert, an update
 * or a delete in any of those tables changes it, whether or not the writer touched `updated_at` (many do not).
 * Rows of other plants are invisible here (row security), so another plant's writes never move it. The fingerprint
 * is compared for equality only, so the 32-bit transaction id wrapping round is harmless.
 */
export async function dataStamp(tx: Db, tenantId: string): Promise<string> {
  const parts = STAMPED_TABLES.map(
    (table) =>
      `(SELECT count(*) || ':' || coalesce(max(xmin::text::bigint), 0) FROM ${table}) AS ${table}`,
  );
  const row = (await tx.query(`SELECT ${parts.join(', ')}`)).rows[0] as Record<string, string>;
  const { name, time_zone: zone } = await tenantInfo(tx, tenantId);
  return [
    ...STAMPED_TABLES.map((table) => row[table]),
    name,
    zone,
    process.env.GIT_COMMIT ?? '',
  ].join('|');
}

const READ_SQL = `SELECT value FROM kpi_snapshot
  WHERE tenant_id = $1 AND profile = '${SERVED_PROFILE}' AND key = '${SERVED_KEY}'
    AND subject_kind = 'plant' AND as_of = $2::date`;

/** The kept run for this date when it was computed from the data in `stamp`; null when none or an older one. */
async function readServed(tx: Db, tenantId: string, asOf: string, stamp: string) {
  const rows = (await tx.query(READ_SQL, [tenantId, asOf])).rows;
  const value = rows[0]?.value as { stamp: string; result: EngineResult } | undefined;
  return value !== undefined && value.stamp === stamp ? value.result : null;
}

const SAVE_SQL = `INSERT INTO kpi_snapshot
       (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of, run_id, value)
VALUES ($1, '${SERVED_PROFILE}', '${SERVED_KEY}', 'plant', '', $2::date, $2::date, $2::date, $3::uuid, $4::jsonb)
ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
DO UPDATE SET value = EXCLUDED.value, computed_at = now(), updated_at = now(), run_id = EXCLUDED.run_id`;

const PRUNE_SQL = `DELETE FROM kpi_snapshot
  WHERE tenant_id = $1 AND profile = '${SERVED_PROFILE}' AND computed_at < now() - $2::int * interval '1 day'`;

/**
 * The run for a plant date, served from the kept copy while the data is unchanged. A miss (nothing kept, or the stamp
 * moved) takes a per-plant-and-date lock, looks again (the reader ahead of this one has just kept the run), and only
 * then calls `compute` and keeps its result; so a burst of readers on a stale date runs the engine once. The stamp
 * is read before the data is loaded, so a write that lands during the compute leaves the kept stamp behind the data
 * and the next read computes again instead of serving a result that misses the write.
 */
export async function servedRun(
  tx: Db,
  input: { tenantId: string; asOf: string; compute: () => Promise<EngineResult> },
): Promise<EngineResult> {
  const { tenantId, asOf, compute } = input;
  const hit = await readServed(tx, tenantId, asOf, await dataStamp(tx, tenantId));
  if (hit) return hit;
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `figures.served:${tenantId}:${asOf}`,
  ]);
  const stamp = await dataStamp(tx, tenantId);
  const kept = await readServed(tx, tenantId, asOf, stamp);
  if (kept) return kept;
  const result = await compute();
  await tx.query(SAVE_SQL, [tenantId, asOf, randomUUID(), JSON.stringify({ stamp, result })]);
  await tx.query(PRUNE_SQL, [tenantId, KEEP_DAYS]);
  return result;
}
