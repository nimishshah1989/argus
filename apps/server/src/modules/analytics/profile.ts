import type { PoolClient } from 'pg';
import {
  DEFAULT_PROFILE,
  PROFILE_KEYS,
  profilePatchSchema,
  type AnalyticsProfile,
} from '@uptimo/shared';
import { ensureSettingRow, setting, settingRowStore, type Resource } from '../plant/index.js';

type Db = Pick<PoolClient, 'query'>;

/** The `setting` key holding the plant's profile. */
export const PROFILE_KEY = 'analytics.profile';

/**
 * The profile the plant runs with: what it set, and the legacy default for every number it never set (or
 * whose stored value is not a number, which the edit route never writes).
 */
export async function readProfile(tx: Db, tenantId: string): Promise<AnalyticsProfile> {
  const stored = ((await setting(tx, tenantId, PROFILE_KEY)) ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    PROFILE_KEYS.map((key) => [
      key,
      typeof stored[key] === 'number' ? stored[key] : DEFAULT_PROFILE[key],
    ]),
  ) as unknown as AnalyticsProfile;
}

/**
 * The generated settings screen for the profile (`/analytics-profile`): one row, made from the legacy defaults on
 * its first read, edited field by field. Head and admin only (the lists cell of DOMAIN §3). An edit is audited
 * as `analytics_profile.update` with only the changed fields, before and after.
 */
export const profileResource: Resource = {
  path: 'analytics-profile',
  table: 'analytics_profile',
  store: settingRowStore(PROFILE_KEY, DEFAULT_PROFILE),
  kind: 'analytics_profile',
  order: 'key',
  columns: Object.fromEntries(PROFILE_KEYS.map((key) => [key, key])),
  patch: profilePatchSchema,
  reply: (row) => ({
    id: row.id,
    ...Object.fromEntries(PROFILE_KEYS.map((key) => [key, row[key]])),
    active: true,
  }),
  prepare: (tx, who) => ensureSettingRow(tx, who.tenantId, PROFILE_KEY, DEFAULT_PROFILE),
};
