import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
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
/** A plant keeps its newest few dates; each save drops the rest. */
const KEEP_DATES = 8;

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
 * What the data and the code looked like when a run was computed: per table the row count, the newest row
 * version's transaction id (`xmin`) and the sum of all of them, the plant's name and time zone, and the build. The
 * sum matters: a transaction that took its id early and commits late writes a version older than the newest one, so
 * the maximum alone would not move, while an update always replaces the row's old id and so moves the sum. An
 * insert, an update or a delete in any of those tables changes it, whether or not the writer touched `updated_at` (many do not).
 * Rows of other plants are invisible here (row security), so another plant's writes never move it. The fingerprint
 * is compared for equality only, so the 32-bit transaction id wrapping round is harmless.
 */
export async function dataStamp(tx: Db, tenantId: string): Promise<string> {
  const parts = STAMPED_TABLES.map(
    (table) =>
      `(SELECT count(*) || ':' || coalesce(max(xmin::text::bigint), 0) || ':' || coalesce(sum(xmin::text::bigint), 0) FROM ${table}) AS ${table}`,
  );
  const row = (await tx.query(`SELECT ${parts.join(', ')}`)).rows[0] as Record<string, string>;
  const { name, time_zone: zone } = await tenantInfo(tx, tenantId);
  return [...STAMPED_TABLES.map((table) => row[table]), name, zone, buildOf()].join('|');
}

/** This process's start: stands in for the build when `GIT_COMMIT` is not a git SHA (unset, or a reused tag). */
const BOOT = String(Date.now());

/** The deploy's commit when it is a full SHA; otherwise the boot time, so no kept run outlives a restart. */
function buildOf(): string {
  const tag = process.env.GIT_COMMIT?.trim() ?? '';
  return /^[0-9a-f]{40}$/i.test(tag) ? tag.toLowerCase() : `boot-${BOOT}`;
}

const READ_SQL = `SELECT value, computed_at >= now() AS saved_since FROM kpi_snapshot
  WHERE tenant_id = $1 AND profile = '${SERVED_PROFILE}' AND key = '${SERVED_KEY}'
    AND subject_kind = 'plant' AND as_of = $2::date`;

type Kept = { value: { stamp: string; result: EngineResult }; savedSince: boolean };

/** The kept row for this date, and whether it was saved after this request's transaction began. */
async function readKept(tx: Db, tenantId: string, asOf: string): Promise<Kept | null> {
  const row = (await tx.query(READ_SQL, [tenantId, asOf])).rows[0];
  return row ? { value: row.value, savedSince: row.saved_since === true } : null;
}

const SAVE_SQL = `INSERT INTO kpi_snapshot
       (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of, run_id, value, computed_at)
VALUES ($1, '${SERVED_PROFILE}', '${SERVED_KEY}', 'plant', '', $2::date, $2::date, $2::date, $3::uuid, $4::jsonb, clock_timestamp())
ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
DO UPDATE SET value = EXCLUDED.value, computed_at = clock_timestamp(), updated_at = now(), run_id = EXCLUDED.run_id`;

/** All but the newest kept runs of the plant; rows another reader holds are skipped, so readers never wait on each other. */
const PRUNE_SQL = `DELETE FROM kpi_snapshot WHERE id IN (
  SELECT id FROM kpi_snapshot
   WHERE tenant_id = $1 AND profile = '${SERVED_PROFILE}'
   ORDER BY computed_at DESC, id OFFSET $2::int
   FOR UPDATE SKIP LOCKED)`;

/** Best effort: a failed prune is rolled back to a savepoint and never fails the read. */
async function prune(tx: Db, tenantId: string): Promise<void> {
  await tx.query('SAVEPOINT served_prune');
  try {
    await tx.query(PRUNE_SQL, [tenantId, KEEP_DATES]);
    await tx.query('RELEASE SAVEPOINT served_prune');
  } catch {
    await tx.query('ROLLBACK TO SAVEPOINT served_prune');
  }
}

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
  const first = await readKept(tx, tenantId, asOf);
  if (first && first.value.stamp === (await dataStamp(tx, tenantId))) return first.value.result;
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `figures.served:${tenantId}:${asOf}`,
  ]);
  // A run saved while this reader waited is served as it is, even when a later write has moved the stamp past it:
  // otherwise each waiter would compute in turn, holding a connection each. The next read sees the moved stamp.
  const kept = await readKept(tx, tenantId, asOf);
  if (kept && (kept.savedSince || kept.value.stamp === (await dataStamp(tx, tenantId))))
    return kept.value.result;
  const stamp = await dataStamp(tx, tenantId);
  const result = await compute();
  await tx.query(SAVE_SQL, [tenantId, asOf, randomUUID(), JSON.stringify({ stamp, result })]);
  await prune(tx, tenantId);
  return result;
}

/** Ticket 606: the queue whose job brings a plant date's kept run up to date after the data moved. */
export const FIGURES_WARM_QUEUE = 'figures.warm';

/** How many reads computed the engine themselves (a cold miss: nothing kept for the date). Must stay 0 once warm. */
export function engineRunsInRead(): number {
  throw new Error('not built');
}

/** Test helper: back to 0. */
export function resetEngineRunsInRead(): void {
  throw new Error('not built');
}

/**
 * The warm job's body: compute the run for the plant date and keep it, exactly as `servedRun` does on a miss (same
 * lock, same save, same prune), but skip when the kept stamp already equals the current data stamp. Does not count
 * as a run in a read. Ticket 606.
 */
export async function warmServedRun(
  _pool: Pool,
  _input: { tenantId: string; asOf: string },
): Promise<void> {
  throw new Error('not built');
}
