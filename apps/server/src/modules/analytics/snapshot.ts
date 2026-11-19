import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { EngineResult, ReliabilityValue } from '@uptimo/domain';
import type { FigureStore } from './service.js';

type Db = Pick<PoolClient, 'query'>;

/** The two definition families a stored figure can belong to (R15): the platform's own and the standard one. */
export type FigureProfile = 'legacy' | 'standard';

/**
 * The profile each stored figure belongs to: the shift-calendar family (and ticket 50's `pm-compliance`) is
 * `standard`, everything else keeps the legacy platform's definitions. One row per figure, never one constant for a
 * mixed run; the table's unique key already includes `profile`, so the two families never collide.
 */
export function profileOfKey(key: string): FigureProfile {
  return key.startsWith('shift-kpis.') || key === 'pm-compliance' || key === 'reliability'
    ? 'standard'
    : 'legacy';
}

/** One plant-row of a run: the figure's key, its own profile and its value, as the table's `jsonb` column takes it. */
type Stored = { key: string; profile: FigureProfile; value: unknown };

/** One per-subject row of ticket 67's figure: a machine or a fit-ready category, never a plant. */
type Subject = { subject_kind: 'machine' | 'category'; subject_key: string; value: unknown };

/**
 * The plant rows of one run, in one statement. `jsonb_to_recordset` turns the ready figures into rows; a JSON null
 * arrives there as a SQL null, so `coalesce` stores it as `'null'::jsonb` (the column allows no SQL null).
 */
const PLANT_SQL = `INSERT INTO kpi_snapshot
       (tenant_id, profile, key, subject_kind, subject_key,
        period_start, period_end, as_of, run_id, value)
SELECT $1, f.profile, f.key, 'plant', '', $2::date, $2::date, $2::date, $4::uuid,
       coalesce(f.value, 'null'::jsonb)
  FROM jsonb_to_recordset($3::jsonb) AS f(key text, profile text, value jsonb)
ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
DO UPDATE SET value = EXCLUDED.value, computed_at = now(), updated_at = now(), run_id = EXCLUDED.run_id`;

/**
 * Ticket 67's rows (R12), in the same statement shape: one row per production machine and one per fit-ready
 * category, keyed by machine id or the trimmed category label. Its `period_start` is the figure's own window start
 * (1 January), which is why the value supplies it rather than the run date.
 */
const SUBJECT_SQL = `INSERT INTO kpi_snapshot
       (tenant_id, profile, key, subject_kind, subject_key,
        period_start, period_end, as_of, run_id, value)
SELECT $1, $4, 'reliability', s.subject_kind, s.subject_key, $2::date, $3::date, $3::date, $5::uuid,
       coalesce(s.value, 'null'::jsonb)
  FROM jsonb_to_recordset($6::jsonb) AS s(subject_kind text, subject_key text, value jsonb)
ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
DO UPDATE SET value = EXCLUDED.value, computed_at = now(), updated_at = now(), run_id = EXCLUDED.run_id`;

/** The object under a value key, or an empty one: a null reliability value writes no rows at all. */
function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The figure's per-subject rows: each machine's block and each category's fit, in the table's subject shape. A
 * subject key the schema cannot hold (a category label over 80 characters) writes no row; the machines still do.
 */
function subjectRows(value: ReliabilityValue): Subject[] {
  const rows: Subject[] = [
    ...Object.entries(recordOf(value.machines)).map(([id, block]) => ({
      subject_kind: 'machine' as const,
      subject_key: id,
      value: block,
    })),
    ...Object.entries(recordOf(value.categories)).map(([label, fit]) => ({
      subject_kind: 'category' as const,
      subject_key: label,
      value: fit,
    })),
  ];
  return rows.filter((row) => row.subject_key !== '' && row.subject_key.length <= 80);
}

/**
 * `kpi_snapshot` is the one place a run is kept: one plant row per ready figure for the run's day; a
 * `not_computed` figure writes nothing, and each row carries its own figure's profile. Ticket 67's `reliability`
 * writes its machine and category rows beside those plant rows, never a plant row of its own. The table's unique key
 * makes a re-run of the same day replace its values instead of adding rows, while another `asOf` starts its own
 * series. One generated id names the whole batch, so a stored day can be told from the next run. Nothing is deleted.
 */
export const snapshotStore: FigureStore = {
  save: async (tx: Db, tenantId: string, result: EngineResult): Promise<void> => {
    const ready = result.figures.filter((figure) => figure.status === 'ready');
    const reliability = ready.find((figure) => figure.key === 'reliability');
    const plants: Stored[] = ready
      .filter((figure) => figure.key !== 'reliability')
      .map((figure) => ({
        key: figure.key,
        profile: profileOfKey(figure.key),
        value: figure.value,
      }));
    if (plants.length === 0 && reliability === undefined) return;
    const runId = randomUUID();
    if (plants.length > 0) {
      await tx.query(PLANT_SQL, [tenantId, result.asOf, JSON.stringify(plants), runId]);
    }
    if (reliability === undefined) return;
    const value = reliability.value as unknown as ReliabilityValue | null;
    if (value === null || typeof value !== 'object') return;
    const rows = subjectRows(value);
    if (rows.length === 0) return;
    await tx.query(SUBJECT_SQL, [
      tenantId,
      value.windowStart,
      result.asOf,
      profileOfKey('reliability'),
      runId,
      JSON.stringify(rows),
    ]);
  },
};
