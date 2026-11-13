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

/** How many tickets a customer holds. Run it inside `withTenant`: an owner login is filtered by row security too. */
export async function countTickets(client: PoolClient, tenantId: string): Promise<number> {
  const result = await client.query('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1', [
    tenantId,
  ]);
  return result.rows[0].n as number;
}
