import type { Pool, PoolClient } from 'pg';

export class MissingTenantError extends Error {
  constructor() {
    super('tenant is required before any query');
    this.name = 'MissingTenantError';
  }
}

let rlsChecked = false;

/**
 * One-time, best-effort guard: the server must connect as `app_api` (a role that is a
 * member of `app_user` with no BYPASSRLS). If the connection is a superuser or BYPASSRLS
 * role, row-level security is silently skipped, so warn loudly instead of failing (a local
 * dev convenience). Production connects as `app_api`, where this check stays quiet.
 */
async function warnIfBypassingRls(pool: Pool): Promise<void> {
  if (rlsChecked) return;
  rlsChecked = true;
  const client = await pool.connect();
  try {
    const row = (
      await client.query(
        'SELECT rolsuper OR rolbypassrls AS bypasses FROM pg_roles WHERE rolname = current_user',
      )
    ).rows[0];
    if (row?.bypasses) {
      console.warn(
        'withTenant: connected as a role that bypasses RLS; connect as app_api for tenant isolation',
      );
    }
  } catch {
    // role check is advisory; never fail a request because of it
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
  await warnIfBypassingRls(pool);
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
