import type { Pool, PoolClient } from 'pg';

export class MissingTenantError extends Error {
  constructor() {
    super('tenant is required before any query');
    this.name = 'MissingTenantError';
  }
}

/**
 * Run a function inside a transaction with app.tenant_id set transaction-locally.
 * A missing tenant throws instead of silently returning an empty list from RLS.
 */
export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) throw new MissingTenantError();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
