import { refuseErased } from './repo/erasure.js';
import { actingTeams } from './repo/acting.js';
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

/** A session is slid forward at most this often; a burst of reads does not rewrite it each time. */
const TOUCH_AFTER = "interval '5 minutes'";

export interface AuthRows {
  login_id: string;
  username: string;
  role: string;
  shared: boolean;
  must_change_password: boolean;
  login_cell: string | null;
  person_id: string | null;
  person_name: string | null;
  person_title: string | null;
  person_active: boolean | null;
  person_team: string | null;
  /** The customer the request's host names, or null when it names none. */
  host_tenant_id: string | null;
  /** Last seen more than five minutes ago: time to slide the session forward. */
  stale: boolean;
}

/**
 * Everything a request needs to know about its sign-in beyond the session itself, in one statement inside one
 * transaction: the login, the acting person, whether the host names this customer and whether the session is due
 * to slide. Nothing is written here.
 */
export async function readAuthRows(
  pool: Pool,
  args: {
    tenantId: string;
    tokenHash: string;
    loginId: string;
    actingPersonId: string | null;
    slug: string | null;
  },
): Promise<AuthRows | undefined> {
  const result = await withTenant(pool, args.tenantId, (client) =>
    client.query(
      `SELECT l.id AS login_id, l.username, l.role, l.shared, l.must_change_password, l.cell AS login_cell,
              p.id AS person_id, p.name AS person_name, p.title AS person_title, p.active AS person_active, p.team AS person_team,
              (SELECT t.id FROM tenant_by_slug($4) t) AS host_tenant_id,
              COALESCE((SELECT s.last_seen_at < now() - ${TOUCH_AFTER} FROM session s WHERE s.token_hash = $2), false) AS stale
       FROM login l LEFT JOIN person p ON p.id = $3
       WHERE l.id = $1`,
      [args.loginId, args.tokenHash, args.actingPersonId, args.slug],
    ),
  );
  return result.rows[0];
}

/** Slides the session forward; the caller has checked that it is due. */
export async function touchSession(pool: Pool, tenantId: string, tokenHash: string): Promise<void> {
  await withTenant(pool, tenantId, (client) =>
    client.query(
      `UPDATE session SET last_seen_at = now(), expires_at = now() + interval '30 days'
       WHERE token_hash = $1 AND last_seen_at < now() - ${TOUCH_AFTER}`,
      [tokenHash],
    ),
  );
}

export async function findPerson(
  pool: Pool,
  tenantId: string,
  personId: string,
): Promise<
  { id: string; name: string; title: string | null; active: boolean; team: string } | undefined
> {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query('SELECT id, name, title, active, team FROM person WHERE id = $1', [personId]),
    )
  ).rows[0];
}

export async function findLogin(pool: Pool, tenantId: string, username: string) {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query(
        'SELECT id, tenant_id, person_id, password_hash, role, shared, disabled_at, must_change_password, cell FROM login WHERE username = $1',
        [username],
      ),
    )
  ).rows[0];
}

/**
 * Starts a sign-in only while the login is on, its password is the one just checked and the acting person
 * is on. The rows are locked until commit, so a switch-off or a reset that comes next waits for this insert
 * and then ends the sign-in it made. Returns false when nothing was inserted.
 */
export async function insertSession(
  pool: Pool,
  args: {
    tenantId: string;
    loginId: string;
    passwordHash: string;
    /** null on a shared phone that has not yet been told who is using it. */
    actingPersonId: string | null;
    /** The teams a shared phone may choose from (`actingTeams`); left out on a personal login. */
    teams?: readonly string[];
    tokenHash: string;
    device?: string;
  },
): Promise<boolean> {
  const result = await withTenant(pool, args.tenantId, async (client) => {
    // Person before login, as a switch-off takes them, so the two never wait on each other.
    if (args.actingPersonId)
      await client.query('SELECT 1 FROM person WHERE id = $1 FOR SHARE', [args.actingPersonId]);
    return client.query(
      `INSERT INTO session (tenant_id, login_id, token_hash, device_label, expires_at, acting_person_id)
       SELECT l.tenant_id, l.id, $3, $4, now() + interval '30 days', p.id
       FROM login l LEFT JOIN person p ON p.id = $2 AND p.tenant_id = l.tenant_id AND p.active
       WHERE l.id = $1 AND l.disabled_at IS NULL AND l.password_hash = $5
         AND ($2::uuid IS NULL OR (p.id IS NOT NULL AND ($6::text[] IS NULL OR p.team = ANY($6::text[]))))
       FOR SHARE OF l`,
      [
        args.loginId,
        args.actingPersonId,
        args.tokenHash,
        args.device ?? null,
        args.passwordHash,
        args.teams ?? null,
      ],
    );
  });
  return (result.rowCount ?? 0) > 0;
}

/** A shared phone chooses who is using it: an active person of the same company and of the teams its role serves. */
export async function setActingPerson(
  pool: Pool,
  args: { tenantId: string; tokenHash: string; personId: string },
): Promise<boolean> {
  const result = await withTenant(pool, args.tenantId, async (client) => {
    await client.query('SELECT 1 FROM person WHERE id = $1 FOR SHARE', [args.personId]);
    const phone = (
      await client.query(
        `SELECT l.role FROM session s JOIN login l ON l.id = s.login_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND l.shared`,
        [args.tokenHash],
      )
    ).rows[0];
    if (!phone) return { rowCount: 0 };
    return client.query(
      `UPDATE session s SET acting_person_id = p.id, updated_at = now()
       FROM person p, login l
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND l.id = s.login_id AND l.shared
         AND p.id = $2 AND p.tenant_id = s.tenant_id AND p.active AND p.team = ANY($3::text[])`,
      [args.tokenHash, args.personId, actingTeams(phone.role)],
    );
  });
  return (result.rowCount ?? 0) > 0;
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
  await tx.query(
    'UPDATE login SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
    [hash, loginId],
  );
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
): Promise<{ name: string; language: string; time_zone: string }> {
  return (await tx.query('SELECT * FROM tenant_info($1)', [tenantId])).rows[0];
}

export interface RedactionTerms {
  names: string[];
  shortNames: string[];
  phones: string[];
  usernames: string[];
  tenantName: string;
}

const clean = (values: (string | null)[]): string[] => [
  ...new Set(values.map((v) => v?.trim() ?? '').filter(Boolean)),
];

/** Every value that identifies a person or the plant, for the AI redactor; values only, no ids. */
export async function redactionTerms(tx: Db, tenantId: string): Promise<RedactionTerms> {
  const people = (
    await tx.query('SELECT name, short_name, phone FROM person WHERE tenant_id = $1', [tenantId])
  ).rows;
  const logins = (await tx.query('SELECT username FROM login WHERE tenant_id = $1', [tenantId]))
    .rows;
  return {
    names: clean(people.map((p) => p.name)),
    shortNames: clean(people.map((p) => p.short_name)),
    phones: clean(people.map((p) => p.phone)),
    usernames: clean(logins.map((l) => l.username)),
    tenantName: (await tenantInfo(tx, tenantId)).name.trim(),
  };
}

export interface NewPerson {
  name: string;
  team: string;
  title: string | null;
  phone: string | null;
  defaultShift: string | null;
  login: { username: string; role: string } | null;
}

/** Locks a customer's row by slug, whatever its status, until the transaction ends. */
export async function lockTenantBySlug(
  tx: Db,
  slug: string,
): Promise<{ id: string; status: string } | undefined> {
  return (await tx.query('SELECT id, status FROM tenant WHERE slug = $1 FOR UPDATE', [slug]))
    .rows[0];
}

export async function deleteTenantBySlug(tx: Db, slug: string): Promise<void> {
  await tx.query('DELETE FROM tenant WHERE slug = $1', [slug]);
}

export async function insertTenant(
  tx: Db,
  t: { slug: string; name: string; language: string; timeZone: string },
): Promise<string> {
  const row = (
    await tx.query(
      'INSERT INTO tenant (slug, name, language, time_zone) VALUES ($1, $2, $3, $4) RETURNING id',
      [t.slug, t.name, t.language, t.timeZone],
    )
  ).rows[0] as { id: string };
  return row.id;
}

export async function insertPeople(
  tx: Db,
  tenantId: string,
  people: NewPerson[],
  passwordHash: string,
): Promise<void> {
  for (const p of people) {
    await refuseErased(tx, tenantId, p);
    const row = (
      await tx.query(
        'INSERT INTO person (tenant_id, name, team, title, phone, default_shift, active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
        [tenantId, p.name, p.team, p.title, p.phone, p.defaultShift],
      )
    ).rows[0] as { id: string };
    if (p.login)
      await tx.query(
        'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared, must_change_password) VALUES ($1, $2, $3, $4, $5, false, true)',
        [tenantId, row.id, p.login.username, passwordHash, p.login.role],
      );
  }
}

export async function peopleByIds(
  tx: Db,
  tenantId: string,
  ids: readonly string[],
): Promise<{ id: string; name: string }[]> {
  return (
    await tx.query('SELECT id, name FROM person WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [
      tenantId,
      ids,
    ])
  ).rows;
}

export async function activePerson(
  tx: Db,
  tenantId: string,
  personId: string,
): Promise<{ id: string; name: string } | undefined> {
  return (
    await tx.query('SELECT id, name FROM person WHERE tenant_id = $1 AND id = $2 AND active', [
      tenantId,
      personId,
    ])
  ).rows[0];
}

export async function activePeople(
  tx: Db,
  tenantId: string,
): Promise<{ id: string; name: string; team: string }[]> {
  return (
    await tx.query(
      'SELECT id, name, team FROM person WHERE tenant_id = $1 AND active ORDER BY name',
      [tenantId],
    )
  ).rows;
}

export async function ensurePendingPerson(tx: Db, tenantId: string, name: string): Promise<string> {
  await refuseErased(tx, tenantId, { name });
  const inserted = await tx.query(
    `INSERT INTO person (tenant_id, name, team, active, pending)
       VALUES ($1, $2, 'production', true, true) RETURNING id`,
    [tenantId, name],
  );
  return inserted.rows[0].id as string;
}

/** Customers that still hold data (not offboarded): the list a nightly job fans out over. */
export async function jobTenantIds(pool: Pool): Promise<string[]> {
  const result = await pool.query('SELECT tenant_id FROM job_tenant_ids()');
  return result.rows.map((row) => row.tenant_id as string);
}

/** Retention: sessions dead (expired or revoked, whichever came first) since before `cutoff`. Never a live one. */
export async function purgeDeadSessions(tx: Db, tenantId: string, cutoff: Date): Promise<number> {
  const result = await tx.query(
    'DELETE FROM session WHERE tenant_id = $1 AND LEAST(expires_at, revoked_at) < $2',
    [tenantId, cutoff],
  );
  return result.rowCount ?? 0;
}

/** What the analytics engine needs of a person: the id, the team and whether they are on. Never a name or a phone. */
export async function peopleForEngine(
  tx: Db,
): Promise<{ id: string; team: string; active: boolean }[]> {
  return (await tx.query('SELECT id, team, active FROM person ORDER BY created_at, id')).rows;
}
