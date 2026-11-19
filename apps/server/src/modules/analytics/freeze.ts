import type { Pool, PoolClient } from 'pg';
import { frozenForMonth } from '@uptimo/domain';
import { assertClockNearDatabase, withTenant } from '../../kernel/index.js';
import { jobTenantIds } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { plantToday } from '../plant/index.js';
import { loadEngineData } from './load.js';
import { readProfile } from './profile.js';
import { insertForecasts, monthFrozen } from './repo/forecast.js';

/**
 * `engine.freeze` (ticket 52, packet 52a): on the 1st it freezes the plant's current month, and on any later day it
 * catches up a missed 1st — both with `as_of` = the month's 1st, so the numbers are the ones the 1st would have
 * produced (R6). It is a no-op once the month has a row, never a replace (R5), and each plant is its own
 * transaction so one failure cannot lose another's work (R18).
 */

export const ENGINE_FREEZE_QUEUE = 'engine.freeze';

export interface EngineFreezeOptions {
  /** The run's instant (the fake clock in tests). */
  now: Date;
  /** One customer only; the default fans out over `jobTenantIds()` like the retention jobs. */
  tenantId?: string;
  /** Only a test with a fake clock passes this. */
  allowFakeClock?: boolean;
}

export interface EngineFreezeResult {
  tenants: number;
  frozen: number;
}

/**
 * One plant's freeze: the plant's own current month, then — only when it has no rows — the plant as it stood on the
 * month's 1st. Writes one statement and, when it inserted rows, one `forecast.freeze` line (R7). A plant with no
 * production breakdown yields no rows, no insert and no audit line, and is retried cheaply tomorrow.
 */
export async function freezeTenant(tx: PoolClient, tenantId: string, now: Date): Promise<number> {
  const today = await plantToday(tx, tenantId, now);
  const month = `${today.slice(0, 7)}-01`;
  if (await monthFrozen(tx, tenantId, month)) return 0;
  const data = await loadEngineData(tx, tenantId);
  const profile = await readProfile(tx, tenantId);
  const rows = frozenForMonth(data, profile, month);
  if (rows.length === 0) return 0;
  const inserted = await insertForecasts(tx, tenantId, { month, frozenAt: now, rows });
  if (inserted > 0)
    await audit.record(tx, {
      tenantId,
      loginId: null,
      action: 'forecast.freeze',
      entity: 'forecast',
      entityId: null,
      before: null,
      after: { month, rows: inserted },
    });
  return inserted;
}

/**
 * Runs the freeze for the named customer, or for every customer that still holds data. Refuses a clock more than
 * 24 hours from the database's before writing anything; only a test with a fake clock passes `allowFakeClock`.
 */
export async function runEngineFreeze(
  pool: Pool,
  options: EngineFreezeOptions,
): Promise<EngineFreezeResult> {
  if (!options.allowFakeClock)
    await assertClockNearDatabase(pool, ENGINE_FREEZE_QUEUE, options.now);
  const tenantIds = options.tenantId ? [options.tenantId] : await jobTenantIds(pool);
  const result: EngineFreezeResult = { tenants: 0, frozen: 0 };
  const errors: unknown[] = [];
  for (const tenantId of tenantIds) {
    try {
      result.frozen += await withTenant(pool, tenantId, (client) =>
        freezeTenant(client, tenantId, options.now),
      );
      result.tenants += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, `${ENGINE_FREEZE_QUEUE} failed`);
  return result;
}
