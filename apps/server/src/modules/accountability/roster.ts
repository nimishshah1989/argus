import type { PoolClient } from 'pg';
import { shiftNowAt } from '../plant/index.js';
import { tenantInfo } from '../identity/index.js';
import { onRosterLine } from './repo/roster.js';

/**
 * Whether the person is on the roster for the shift running at `at`, on that shift's own date (a night shift after
 * midnight belongs to the day it started), both read from the one running shift. No shift covers the moment: nobody
 * is on the roster. A vendor-level line does not count: a vendor is told, but does not stop the clock.
 */
export async function onRosterAt(
  client: PoolClient,
  tenantId: string,
  personId: string,
  at: Date,
): Promise<boolean> {
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  const shift = await shiftNowAt(client, zone, at);
  if (!shift) return false;
  return onRosterLine(client, tenantId, { personId, date: shift.day, shiftId: shift.id });
}
