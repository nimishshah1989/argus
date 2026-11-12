import type { Pool, PoolClient } from 'pg';

export class MissingTenantError extends Error {
  constructor() {
    super('tenant is required before any query');
    this.name = 'MissingTenantError';
  }
}

const rlsChecks = new WeakMap<Pool, Promise<void>>();

/** Check each pool once; production's app_api role must never bypass tenant RLS. */
async function checkRlsRole(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const row = (
      await client.query(
        'SELECT current_user AS name, rolsuper OR rolbypassrls AS bypasses FROM pg_roles WHERE rolname = current_user',
      )
    ).rows[0];
    if (row?.bypasses && row.name === 'app_api') {
      throw new Error('withTenant: app_api must not be a superuser or bypass RLS');
    }
    if (row?.bypasses) {
      console.warn(
        'withTenant: connected as a role that bypasses RLS; connect as app_api for tenant isolation',
      );
    }
  } finally {
    client.release();
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
  let roleCheck = rlsChecks.get(pool);
  if (!roleCheck) {
    roleCheck = checkRlsRole(pool);
    rlsChecks.set(pool, roleCheck);
  }
  await roleCheck;
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
