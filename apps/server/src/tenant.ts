import type { Pool } from 'pg';

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  time_zone: string;
}

// The no-domain stage: a bare IP (the Elastic IP) has no subdomain to resolve, so it
// maps to the default tenant. Overridable, not a plant-specific value baked into logic.
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? 'cosmos';

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  return host.startsWith('[') && host.includes(':'); // IPv6 literal
}

export function tenantSlugFromHost(host: string): string | null {
  const clean = host.replace(/:\d+$/, '').toLowerCase();
  if (isIpLiteral(clean)) return DEFAULT_TENANT_SLUG;
  const dot = clean.indexOf('.');
  if (dot <= 0) return null;
  return clean.slice(0, dot) || null;
}

export async function resolveTenant(pool: Pool, slug: string): Promise<TenantRow | null> {
  const result = await pool.query('SELECT * FROM tenant_by_slug($1)', [slug]);
  return (result.rows[0] as TenantRow | undefined) ?? null;
}
