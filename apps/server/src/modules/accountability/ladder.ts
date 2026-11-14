import type { PoolClient } from 'pg';
import { ESCALATION_DEFAULTS } from '@uptimo/domain';
import { audit } from '../ops/index.js';
import { plantToday } from '../plant/index.js';
import {
  deleteRosterBefore,
  hasEscalationRules,
  insertEscalationDefault,
  lockLadderSeed,
} from './repo/ladder.js';

/** `day` (YYYY-MM-DD) moved by `days` calendar days. */
export function shiftDay(day: string, days: number): string {
  const moved = new Date(`${day}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** How long a roster line is kept: the oldest date a plant accepts for a new line is its own today minus this. */
export const ROSTER_KEEP_DAYS = 365;

/**
 * Gives a plant that has no ladder yet the starting one (`ESCALATION_DEFAULTS`), as ordinary rows the head can edit.
 * A plant that has any rule, switched off ones included, is left exactly as it is, so an edited ladder is never
 * overwritten. Safe to call again and from two places at once (the first seeding takes a lock, so there is one audit row; a plant that has its ladder never takes it). Whatever
 * reads the rules (escalation, ticket 33) calls this first, so a plant whose head never opened the ladder screen
 * still escalates.
 */
export async function ensureEscalationDefaults(
  client: PoolClient,
  who: { tenantId: string; loginId: string | null },
): Promise<void> {
  // Nearly every call finds the ladder there: read without the lock, and take it only to seed.
  if (await hasEscalationRules(client)) return;
  await lockLadderSeed(client, who.tenantId);
  if (await hasEscalationRules(client)) return;
  for (const rule of ESCALATION_DEFAULTS) await insertEscalationDefault(client, who.tenantId, rule);
  await audit.record(client, {
    tenantId: who.tenantId,
    loginId: who.loginId,
    action: 'escalation_rule.seed',
    entity: 'escalation_rule',
    before: null,
    after: { rules: ESCALATION_DEFAULTS.length },
  });
}

/**
 * The nightly retention: roster lines older than a year by the plant's own date at `now` go. The plant's date, not
 * UTC's, so a plant west of UTC keeps the 365th day its form still accepts.
 */
export async function purgeRoster(
  client: PoolClient,
  tenantId: string,
  now: Date,
): Promise<number> {
  const cutoff = shiftDay(await plantToday(client, tenantId, now), -ROSTER_KEEP_DAYS);
  return deleteRosterBefore(client, tenantId, cutoff);
}
