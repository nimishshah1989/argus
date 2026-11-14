import type { PoolClient } from 'pg';
import { DEFAULT_LOCKOUT_STEPS } from '@uptimo/shared';
import { audit } from '../ops/index.js';

/**
 * Gives a plant that has no lockout steps yet the four starting ones (`DEFAULT_LOCKOUT_STEPS`), as ordinary rows
 * the head can edit. A plant that has any step, switched-off ones included, is left exactly as it is, so an edited
 * list is never overwritten. Safe to call again and from two places at once (they take turns). Whatever reads
 * the steps calls this first, so a plant whose head never opened the list still has a checklist.
 */
export async function ensureLockoutSteps(
  tx: Pick<PoolClient, 'query'>,
  who: { tenantId: string; loginId: string | null },
): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lockout-seed:${who.tenantId}`]);
  const has = await tx.query(
    "SELECT 1 FROM list_item WHERE tenant_id = $1 AND list = 'lockout_step' LIMIT 1",
    [who.tenantId],
  );
  if ((has.rowCount ?? 0) > 0) return;
  for (const [index, step] of DEFAULT_LOCKOUT_STEPS.entries()) {
    await tx.query(
      `INSERT INTO list_item (tenant_id, list, code, label, sort) VALUES ($1, 'lockout_step', $2, $3, $4)
       ON CONFLICT (tenant_id, list, code) DO NOTHING`,
      [who.tenantId, step.code, step.label, index + 1],
    );
  }
  await audit.record(tx as PoolClient, {
    tenantId: who.tenantId,
    loginId: who.loginId,
    action: 'lockout_step.seed',
    entity: 'list_item',
    before: null,
    after: { steps: DEFAULT_LOCKOUT_STEPS.length },
  });
}
