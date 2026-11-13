import { Pool } from 'pg';

/** Pool on MIGRATION_DATABASE_URL (D24: operator scripts run as the database owner). */
export function operatorPool(): Pool {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is required');
  return new Pool({ connectionString: url, max: 1 });
}

/** `tenant` has no row security, so the owner sees every customer; each tenant's rows still need app.tenant_id. */
export async function listTenants(pool: Pool): Promise<Array<{ id: string; slug: string }>> {
  return (await pool.query('SELECT id, slug FROM tenant ORDER BY slug')).rows;
}
