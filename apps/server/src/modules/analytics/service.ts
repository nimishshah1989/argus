import type { PoolClient } from 'pg';
import type { YearsChoice } from '@uptimo/shared';
import { recordedYears, run, type EngineData, type EngineResult } from '@uptimo/domain';
import { loadEngineData } from './load.js';
import { readProfile } from './profile.js';

type Db = Pick<PoolClient, 'query'>;

/**
 * Where a run's figures are kept. Nothing is kept yet: `kpi_snapshot` arrives with migration 0014, and its writer
 * is the one implementation that replaces `notStored`.
 */
export interface FigureStore {
  save(tx: Db, tenantId: string, result: EngineResult): Promise<void>;
}

export const notStored: FigureStore = { save: async () => undefined };

/**
 * The engine's span for a `?years=` choice (ADR 0063): 1 January of the first year to 31 December of the last (the
 * engine stops it at the run date); `all` starts at the first recorded year. None is the default read.
 */
function spanOf(data: EngineData, asOf: string, years: YearsChoice | undefined) {
  if (years === undefined) return undefined;
  const first =
    years === 'all' ? (recordedYears(data, asOf)[0] ?? Number(asOf.slice(0, 4))) : years.from;
  const last = years === 'all' ? Number(asOf.slice(0, 4)) : years.to;
  return { from: `${first}-01-01`, to: `${last}-12-31` };
}

/**
 * Runs the engine for a plant as of a plant date: the plant's rows, its profile, the pure `run` (over the years asked,
 * when a reader picked some), then the store. Everything runs in the caller's tenant transaction.
 */
export async function runForTenant(
  tx: Db,
  input: { tenantId: string; asOf: string; store?: FigureStore; years?: YearsChoice },
): Promise<EngineResult> {
  const { tenantId, asOf, store = notStored } = input;
  const data = await loadEngineData(tx, tenantId);
  const profile = await readProfile(tx, tenantId);
  const result = run(data, asOf, profile, spanOf(data, asOf, input.years));
  await store.save(tx, tenantId, result);
  return result;
}
