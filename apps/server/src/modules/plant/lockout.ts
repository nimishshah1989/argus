import type { PoolClient } from 'pg';
import { DEFAULT_LOCKOUT_STEPS } from '@uptimo/shared';
import { audit } from '../ops/index.js';
import { hasLockoutSteps, insertLockoutStep, lockLockoutSeed } from './repo/reads.js';

/**
 * Gives a plant that has no lockout steps yet the four starting ones (`DEFAULT_LOCKOUT_STEPS`), as ordinary rows
 * the head can edit. A plant that has any step, switched-off ones included, is left exactly as it is, so an edited
 * list is never overwritten. Safe to call again and from two places at once (they take turns). Whatever reads
 * the steps calls this first, so a plant whose head never opened the list still has a checklist.
 */
export async function ensureLockoutSteps(
  tx: PoolClient,
  who: { tenantId: string; loginId: string | null },
): Promise<void> {
  await lockLockoutSeed(tx, who.tenantId);
  if (await hasLockoutSteps(tx, who.tenantId)) return;
  for (const [index, step] of DEFAULT_LOCKOUT_STEPS.entries()) {
    await insertLockoutStep(tx, who.tenantId, { ...step, sort: index + 1 });
  }
  await audit.record(tx, {
    tenantId: who.tenantId,
    loginId: who.loginId,
    action: 'lockout_step.seed',
    entity: 'list_item',
    before: null,
    after: { steps: DEFAULT_LOCKOUT_STEPS.length },
  });
}
