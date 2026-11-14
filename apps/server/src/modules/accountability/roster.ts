import type { PoolClient } from 'pg';
import { productionDateAt, shiftIdAt } from '../plant/index.js';
import { tenantInfo } from '../identity/index.js';
import { onRosterLine } from './repo/roster.js';

/**
 * Whether the person is on the roster for the shift running at `at`, on that shift's production date (a night shift
 * after midnight belongs to the day it started). No shift covers the moment: nobody is on the roster.
 */
export async function onRosterAt(
  client: PoolClient,
  tenantId: string,
  personId: string,
  at: Date,
): Promise<boolean> {
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  const shiftId = await shiftIdAt(client, zone, at);
  if (!shiftId) return false;
  const date = await productionDateAt(client, zone, at);
  return onRosterLine(client, tenantId, { personId, date, shiftId });
}
