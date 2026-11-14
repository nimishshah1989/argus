import type { Pool, PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface ProfileChange {
  name?: string;
  language?: string;
  timeZone?: string;
}

/** Changes the signed-in plant's name, language or time zone. The database writes only the plant the request is in. */
export async function updateTenantProfile(tx: Db, change: ProfileChange): Promise<void> {
  await tx.query('SELECT tenant_update_profile($1, $2, $3)', [
    change.name ?? null,
    change.language ?? null,
    change.timeZone ?? null,
  ]);
}

/** Points the signed-in plant at one of its logo files, or at none. */
export async function setTenantLogo(tx: Db, fileId: string | null): Promise<void> {
  await tx.query('SELECT tenant_set_logo($1)', [fileId]);
}

/** The logo file of the company at this address, for the public brand route; null when it has none. */
export async function tenantLogoId(pool: Pool, slug: string): Promise<string | null> {
  const result = await pool.query('SELECT tenant_logo($1) AS id', [slug]);
  return (result.rows[0]?.id as string | null) ?? null;
}
