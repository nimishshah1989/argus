import type { Pool } from 'pg';

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  time_zone: string;
}

export function tenantSlugFromHost(host: string): string | null {
  const clean = host.replace(/:\d+$/, '').toLowerCase();
  const dot = clean.indexOf('.');
  if (dot <= 0) return null;
  return clean.slice(0, dot) || null;
}

export async function resolveTenant(pool: Pool, slug: string): Promise<TenantRow | null> {
  const result = await pool.query('SELECT * FROM tenant_by_slug($1)', [slug]);
  return (result.rows[0] as TenantRow | undefined) ?? null;
}
