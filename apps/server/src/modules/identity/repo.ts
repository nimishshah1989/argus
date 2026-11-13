import type { Pool, PoolClient } from 'pg';
import { withTenant } from '../../kernel/index.js';

type Db = Pick<PoolClient, 'query'>;

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  time_zone: string;
}

export interface SessionLookup {
  tenant_id: string;
  login_id: string;
  acting_person_id: string | null;
}

export async function resolveTenant(pool: Pool, slug: string): Promise<TenantRow | null> {
  const result = await pool.query('SELECT * FROM tenant_by_slug($1)', [slug]);
  return (result.rows[0] as TenantRow | undefined) ?? null;
}

export async function lookupSession(
  pool: Pool,
  tokenHash: string,
): Promise<SessionLookup | undefined> {
  return (await pool.query('SELECT * FROM auth_lookup($1)', [tokenHash])).rows[0];
}

export async function touchSession(pool: Pool, tenantId: string, tokenHash: string): Promise<void> {
  await withTenant(pool, tenantId, (client) =>
    client.query(
      "UPDATE session SET last_seen_at = now(), expires_at = now() + interval '30 days' WHERE token_hash = $1",
      [tokenHash],
    ),
  );
}

export async function loginById(
  pool: Pool,
  tenantId: string,
  loginId: string,
): Promise<{ id: string; username: string; role: string; shared: boolean } | undefined> {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query('SELECT id, username, role, shared FROM login WHERE id = $1', [loginId]),
    )
  ).rows[0];
}

export async function findPerson(
  pool: Pool,
  tenantId: string,
  personId: string,
): Promise<{ id: string; name: string; title: string | null } | undefined> {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query('SELECT id, name, title FROM person WHERE id = $1', [personId]),
    )
  ).rows[0];
}

export async function findLogin(pool: Pool, tenantId: string, username: string) {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query(
        'SELECT id, tenant_id, person_id, password_hash, role, shared, disabled_at FROM login WHERE username = $1',
        [username],
      ),
    )
  ).rows[0];
}

export async function insertSession(
  pool: Pool,
  args: {
    tenantId: string;
    loginId: string;
    device?: string;
    actingPersonId: string;
    tokenHash: string;
  },
): Promise<void> {
  await withTenant(pool, args.tenantId, (client) =>
    client.query(
      "INSERT INTO session (tenant_id, login_id, token_hash, device_label, expires_at, acting_person_id) VALUES ($1, $2, $3, $4, now() + interval '30 days', $5)",
      [args.tenantId, args.loginId, args.tokenHash, args.device ?? null, args.actingPersonId],
    ),
  );
}

export async function revokeSession(pool: Pool, tenantId: string, tokenHash: string) {
  await withTenant(pool, tenantId, (client) =>
    client.query('UPDATE session SET revoked_at = now() WHERE token_hash = $1', [tokenHash]),
  );
}

export async function passwordHashOf(tx: Db, loginId: string): Promise<string> {
  const row = (await tx.query('SELECT password_hash FROM login WHERE id = $1', [loginId])).rows[0];
  return row.password_hash;
}

export async function setPasswordHash(tx: Db, loginId: string, hash: string): Promise<void> {
  await tx.query('UPDATE login SET password_hash = $1 WHERE id = $2', [hash, loginId]);
}

export async function revokeOtherSessions(
  tx: Db,
  loginId: string,
  keepTokenHash: string,
): Promise<void> {
  await tx.query('UPDATE session SET revoked_at = now() WHERE login_id = $1 AND token_hash <> $2', [
    loginId,
    keepTokenHash,
  ]);
}

export async function listPeople(tx: Db): Promise<Record<string, unknown>[]> {
  return (await tx.query('SELECT id, name, team, title, active, phone FROM person ORDER BY name'))
    .rows;
}

export async function tenantInfo(
  tx: Db,
  tenantId: string,
): Promise<{ language: string; time_zone: string }> {
  return (await tx.query('SELECT * FROM tenant_info($1)', [tenantId])).rows[0];
}
