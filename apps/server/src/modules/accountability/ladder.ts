import type { PoolClient } from 'pg';
import { ESCALATION_DEFAULTS } from '@uptimo/domain';
import { audit } from '../ops/index.js';
import { deleteRosterBefore, hasEscalationRules, insertEscalationDefault } from './repo/ladder.js';

/**
 * Gives a plant that has no ladder yet the starting one (`ESCALATION_DEFAULTS`), as ordinary rows the head can edit.
 * A plant that has any rule, switched off ones included, is left exactly as it is, so an edited ladder is never
 * overwritten. Safe to call again and from two places at once. Whatever reads the rules (escalation, ticket 33) calls
 * this first, so a plant whose head never opened the ladder screen still escalates.
 */
export async function ensureEscalationDefaults(
  client: PoolClient,
  who: { tenantId: string; loginId: string | null },
): Promise<void> {
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

/** The nightly retention: roster lines dated before `before` (a plant date, the day part is used) go. */
export function purgeRoster(client: PoolClient, tenantId: string, before: Date): Promise<number> {
  return deleteRosterBefore(client, tenantId, before.toISOString().slice(0, 10));
}
