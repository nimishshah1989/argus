import type { PoolClient } from 'pg';
import type { LoginAdmin, PersonAdmin } from '@uptimo/shared';
import { refuseErased } from './erasure.js';

type Db = Pick<PoolClient, 'query'>;

const PERSON_COLUMNS = {
  name: 'name',
  shortName: 'short_name',
  phone: 'phone',
  team: 'team',
  title: 'title',
  cell: 'cell',
  defaultShift: 'default_shift',
  active: 'active',
} as const;

export type PersonFields = Partial<{ [K in keyof typeof PERSON_COLUMNS]: unknown }>;

const PERSON_SELECT =
  'id, name, short_name, phone, team, title, cell, default_shift, active, pending';

/** The newest session start of any login this person holds; null when none of them has ever signed in. */
const PERSON_LAST_SIGN_IN =
  '(SELECT max(s.created_at) FROM session s JOIN login l ON l.tenant_id = s.tenant_id AND l.id = s.login_id WHERE l.person_id = person.id) AS last_sign_in_at';

const toStamp = (value: unknown): string | null =>
  value ? new Date(value as string | Date).toISOString() : null;

function toPerson(r: Record<string, unknown>): PersonAdmin {
  return {
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    phone: r.phone,
    team: r.team,
    title: r.title,
    cell: r.cell,
    defaultShift: r.default_shift,
    active: r.active,
    pending: r.pending,
    lastSignInAt: toStamp(r.last_sign_in_at),
  } as PersonAdmin;
}

/** The columns of a login reply: the password and its hash are never among them. */
const LOGIN_COLUMNS =
  'id, username, role, shared, person_id, cell, must_change_password, disabled_at';

/** The newest session start of this login; null when it has never signed in. */
const LOGIN_LAST_SIGN_IN =
  '(SELECT max(s.created_at) FROM session s WHERE s.login_id = login.id) AS last_sign_in_at';

const LOGIN_SELECT = `${LOGIN_COLUMNS}, ${LOGIN_LAST_SIGN_IN}`;

function toLogin(r: Record<string, unknown>): LoginAdmin {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    shared: r.shared,
    personId: r.person_id,
    cell: r.cell,
    mustChangePassword: r.must_change_password,
    active: r.disabled_at === null,
    lastSignInAt: toStamp(r.last_sign_in_at),
  } as LoginAdmin;
}

/** One writer at a time per customer: the last-admin check and the switch-off cascade read, then write. */
export async function lockPeopleWrites(tx: Db, tenantId: string): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`people:${tenantId}`]);
}

export async function listPersonAdmin(tx: Db): Promise<PersonAdmin[]> {
  const rows = (
    await tx.query(`SELECT ${PERSON_SELECT}, ${PERSON_LAST_SIGN_IN} FROM person ORDER BY name, id`)
  ).rows;
  return rows.map(toPerson);
}

export async function personAdminById(tx: Db, id: string): Promise<PersonAdmin | undefined> {
  const row = (
    await tx.query(`SELECT ${PERSON_SELECT}, ${PERSON_LAST_SIGN_IN} FROM person WHERE id = $1`, [id])
  ).rows[0];
  return row && toPerson(row);
}

export async function insertPerson(
  tx: Db,
  tenantId: string,
  p: PersonFields & { name: unknown; team: unknown },
): Promise<{ person: PersonAdmin; possibleErasedMatch: boolean }> {
  const possibleErasedMatch = await refuseErased(tx, tenantId, {
    name: String(p.name),
    phone: p.phone as string | null,
  });
  const row = (
    await tx.query(
      `INSERT INTO person (tenant_id, name, short_name, phone, team, title, cell, default_shift, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING ${PERSON_SELECT}`,
      [tenantId, p.name, p.shortName, p.phone, p.team, p.title, p.cell, p.defaultShift].map(
        (v) => v ?? null,
      ),
    )
  ).rows[0];
  return { person: toPerson(row), possibleErasedMatch };
}

export async function updatePerson(tx: Db, id: string, fields: PersonFields): Promise<PersonAdmin> {
  const set: string[] = ['updated_at = now()'];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(PERSON_COLUMNS)) {
    const value = fields[key as keyof PersonFields];
    if (value === undefined) continue;
    values.push(value);
    set.push(`${column} = $${values.length}`);
  }
  const updated = (
    await tx.query(`UPDATE person SET ${set.join(', ')} WHERE id = $1 RETURNING id`, values)
  ).rows[0];
  // Re-read with the newest sign-in, so the reply says what the list would say.
  return (await personAdminById(tx, updated.id)) as PersonAdmin;
}

export async function listLoginAdmin(tx: Db): Promise<LoginAdmin[]> {
  const rows = (await tx.query(`SELECT ${LOGIN_SELECT} FROM login ORDER BY username`)).rows;
  return rows.map(toLogin);
}

export async function loginAdminById(tx: Db, id: string): Promise<LoginAdmin | undefined> {
  const row = (await tx.query(`SELECT ${LOGIN_SELECT} FROM login WHERE id = $1`, [id])).rows[0];
  return row && toLogin(row);
}

export async function loginsOfPerson(tx: Db, personId: string): Promise<LoginAdmin[]> {
  const rows = (
    await tx.query(`SELECT ${LOGIN_SELECT} FROM login WHERE person_id = $1 ORDER BY username`, [
      personId,
    ])
  ).rows;
  return rows.map(toLogin);
}

export async function insertLogin(
  tx: Db,
  tenantId: string,
  l: { username: string; role: string; personId: string | null; cell: string | null },
  passwordHash: string,
): Promise<LoginAdmin> {
  const row = (
    await tx.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared, cell, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $2::uuid IS NULL, $6, true) RETURNING id`,
      [tenantId, l.personId, l.username, passwordHash, l.role, l.cell],
    )
  ).rows[0];
  return (await loginAdminById(tx, row.id)) as LoginAdmin;
}

export interface LoginChange {
  role?: string;
  cell?: string | null;
  /** A new hash from the admin's temporary password; sets "must change password". */
  passwordHash?: string;
  /** true switches off (keeping the first time), false switches on. */
  disabled?: boolean;
}

export async function updateLogin(tx: Db, id: string, c: LoginChange): Promise<LoginAdmin> {
  const row = (
    await tx.query(
      `UPDATE login SET
         role = COALESCE($2, role),
         cell = CASE WHEN $3::boolean THEN $4 ELSE cell END,
         password_hash = COALESCE($5, password_hash),
         must_change_password = must_change_password OR $5::text IS NOT NULL,
         disabled_at = CASE WHEN $6::boolean IS NULL THEN disabled_at
                            WHEN $6::boolean THEN COALESCE(disabled_at, now()) ELSE NULL END,
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [
        id,
        c.role ?? null,
        c.cell !== undefined,
        c.cell ?? null,
        c.passwordHash ?? null,
        c.disabled ?? null,
      ],
    )
  ).rows[0];
  return (await loginAdminById(tx, row.id)) as LoginAdmin;
}

/** Switches off every login of a person; returns the usernames that were still on. */
export async function disableLoginsOfPerson(tx: Db, personId: string): Promise<string[]> {
  const rows = (
    await tx.query(
      'UPDATE login SET disabled_at = now(), updated_at = now() WHERE person_id = $1 AND disabled_at IS NULL RETURNING username',
      [personId],
    )
  ).rows;
  return rows.map((r) => r.username as string).sort();
}

/** Ends every live sign-in of these logins. */
export async function endSessions(tx: Db, loginIds: readonly string[]): Promise<number> {
  const result = await tx.query(
    'UPDATE session SET revoked_at = now(), updated_at = now() WHERE revoked_at IS NULL AND login_id = ANY($1::uuid[])',
    [loginIds],
  );
  return result.rowCount ?? 0;
}

/**
 * A shared phone keeps its sign-in when the person it was acting as is switched off, but no longer acts as
 * them; the app asks who is using it. Returns how many sign-ins were cleared.
 */
export async function clearActingPerson(tx: Db, personId: string): Promise<number> {
  const result = await tx.query(
    'UPDATE session SET acting_person_id = NULL, updated_at = now() WHERE revoked_at IS NULL AND acting_person_id = $1',
    [personId],
  );
  return result.rowCount ?? 0;
}

export type ActingCheck = 'ok' | 'login_off' | 'person_off' | 'unknown_person';

/**
 * Whether this login may register a device as this person right now, with both rows locked until commit so a
 * switch-off that follows waits for the registration and then removes it.
 */
export async function lockLiveActing(
  tx: Db,
  who: { tenantId: string; loginId: string; personId: string },
): Promise<ActingCheck> {
  // Person before login, as a switch-off takes them, so the two never wait on each other.
  const person = (
    await tx.query('SELECT active FROM person WHERE id = $1 AND tenant_id = $2 FOR SHARE', [
      who.personId,
      who.tenantId,
    ])
  ).rows[0];
  const login = (
    await tx.query('SELECT disabled_at FROM login WHERE id = $1 AND tenant_id = $2 FOR SHARE', [
      who.loginId,
      who.tenantId,
    ])
  ).rows[0];
  if (!login || login.disabled_at) return 'login_off';
  if (!person) return 'unknown_person';
  return person.active ? 'ok' : 'person_off';
}

/** Writes to a person take this first, so anything that is putting them on a ticket finishes before it looks. */
export async function lockPerson(tx: Db, personId: string): Promise<void> {
  await tx.query('SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [personId]);
}

/** A person who is on, locked until commit: whoever adds them to a ticket reads them this way. */
export async function lockActivePerson(
  tx: Db,
  tenantId: string,
  personId: string,
): Promise<{ id: string; name: string } | undefined> {
  return (
    await tx.query(
      'SELECT id, name FROM person WHERE tenant_id = $1 AND id = $2 AND active FOR SHARE',
      [tenantId, personId],
    )
  ).rows[0];
}

/** Enabled personal admin logins other than `excluding`, whose person is on: who could still manage people. */
export async function otherAdminCount(tx: Db, excluding: readonly string[]): Promise<number> {
  const row = (
    await tx.query(
      `SELECT count(*)::int AS n FROM login l JOIN person p ON p.id = l.person_id
       WHERE l.role = 'admin' AND NOT l.shared AND l.disabled_at IS NULL AND p.active
         AND l.id <> ALL($1::uuid[])`,
      [excluding],
    )
  ).rows[0];
  return row.n as number;
}

/**
 * The people in a plant who hold an enabled personal login with one of these roles and are themselves on, one entry
 * each. A shared phone has no person, so it never appears. Used to decide who an alert goes to.
 */
export async function peopleWithRole(
  tx: Db,
  tenantId: string,
  roles: readonly string[],
): Promise<string[]> {
  const rows = (
    await tx.query(
      `SELECT DISTINCT p.id FROM login l JOIN person p ON p.tenant_id = l.tenant_id AND p.id = l.person_id
       WHERE l.tenant_id = $1 AND l.role = ANY($2::text[]) AND NOT l.shared
         AND l.disabled_at IS NULL AND p.active
       ORDER BY p.id`,
      [tenantId, roles],
    )
  ).rows;
  return rows.map((r) => r.id as string);
}
