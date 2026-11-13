import type { PoolClient } from 'pg';

/** First reference numbers for a fresh tenant (cosmos seed). */
export async function initRefCounters(
  tx: Pick<PoolClient, 'query'>,
  tenantId: string,
): Promise<void> {
  await tx.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150), ($1, 'WR', 99)",
    [tenantId],
  );
}
