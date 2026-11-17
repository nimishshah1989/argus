import type { PoolClient } from 'pg';
import type { EngineResult } from '@uptimo/domain';
import type { FigureStore } from './service.js';

type Db = Pick<PoolClient, 'query'>;

/** Every stored figure belongs to the legacy profile until a second profile exists (the legacy answer key). */
const PROFILE = 'legacy';

/** One plant-row of a run: the figure's key and its value, as the table's `jsonb` column takes it. */
type Stored = { key: string; value: unknown };

/**
 * The rows of one run, in one statement. `jsonb_to_recordset` turns the ready figures into rows; a JSON null
 * arrives there as a SQL null, so `coalesce` stores it as `'null'::jsonb` (the column allows no SQL null).
 */
const SQL = `WITH run AS (SELECT gen_random_uuid() AS run_id)
INSERT INTO kpi_snapshot
       (tenant_id, profile, key, subject_kind, subject_key,
        period_start, period_end, as_of, run_id, value)
SELECT $1, $2, f.key, 'plant', '', $3::date, $3::date, $3::date, run.run_id,
       coalesce(f.value, 'null'::jsonb)
  FROM jsonb_to_recordset($4::jsonb) AS f(key text, value jsonb), run
ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
DO UPDATE SET value = EXCLUDED.value, computed_at = now(), updated_at = now(), run_id = EXCLUDED.run_id`;

/**
 * `kpi_snapshot` is the one place a run is kept: one plant row per ready figure for the run's day; a
 * `not_computed` figure writes nothing. The table's unique key makes a re-run of the same day replace its values
 * instead of adding rows, while another `asOf` starts its own series. One `gen_random_uuid()` names the whole
 * batch, so a stored day can be told from the next run. Nothing is ever deleted.
 */
export const snapshotStore: FigureStore = {
  save: async (tx: Db, tenantId: string, result: EngineResult): Promise<void> => {
    const ready = result.figures.filter((figure) => figure.status === 'ready');
    if (ready.length === 0) return;
    const rows: Stored[] = ready.map((figure) => ({ key: figure.key, value: figure.value }));
    await tx.query(SQL, [tenantId, PROFILE, result.asOf, JSON.stringify(rows)]);
  },
};
