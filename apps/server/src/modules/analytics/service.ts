import type { PoolClient } from 'pg';
import { run, type EngineResult } from '@uptimo/domain';
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
 * Runs the engine for a plant as of a plant date: the plant's rows, its profile, the pure `run`, then the store.
 * Everything runs in the caller's tenant transaction.
 */
export async function runForTenant(
  tx: Db,
  input: { tenantId: string; asOf: string; store?: FigureStore },
): Promise<EngineResult> {
  const { tenantId, asOf, store = notStored } = input;
  const data = await loadEngineData(tx);
  const profile = await readProfile(tx, tenantId);
  const result = run(data, asOf, profile);
  await store.save(tx, tenantId, result);
  return result;
}
