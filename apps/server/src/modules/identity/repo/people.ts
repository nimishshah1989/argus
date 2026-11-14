import type { PoolClient } from 'pg';
import type { LoginAdmin, PersonAdmin } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;

const PERSON_COLUMNS = {
  name: 'name',
  shortName: 'short_name',
  phone: 'phone',
  team: 'team',
  kind: 'kind',
  title: 'title',
  cell: 'cell',
  defaultShift: 'default_shift',
  active: 'active',
} as const;

export type PersonFields = Partial<{ [K in keyof typeof PERSON_COLUMNS]: unknown }>;

const PERSON_SELECT =
  'id, name, short_name, phone, team, kind, title, cell, default_shift, active, pending';

function toPerson(r: Record<string, unknown>): PersonAdmin {
  return {
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    phone: r.phone,
    team: r.team,
    kind: r.kind,
    title: r.title,
    cell: r.cell,
    defaultShift: r.default_shift,
    active: r.active,
    pending: r.pending,
  } as PersonAdmin;
}

const LOGIN_SELECT =
  'id, username, role, shared, person_id, cell, must_change_password, disabled_at';

function toLogin(r: Record<string, unknown>): LoginAdmin {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    shared: r.shared,
    personId: r.person_id,
    cell: r.cell,
    mustChangePassword: r.must_change_password,
    disabled: r.disabled_at !== null,
  } as LoginAdmin;
}

/** One writer at a time per customer: the last-admin check and the switch-off cascade read, then write. */
export async function lockPeopleWrites(tx: Db, tenantId: string): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`people:${tenantId}`]);
}

export async function listPersonAdmin(tx: Db): Promise<PersonAdmin[]> {
  const rows = (await tx.query(`SELECT ${PERSON_SELECT} FROM person ORDER BY name, id`)).rows;
  return rows.map(toPerson);
}

export async function personAdminById(tx: Db, id: string): Promise<PersonAdmin | undefined> {
  const row = (await tx.query(`SELECT ${PERSON_SELECT} FROM person WHERE id = $1`, [id])).rows[0];
  return row && toPerson(row);
}

export async function insertPerson(
  tx: Db,
  tenantId: string,
  p: PersonFields & { name: unknown; team: unknown },
): Promise<PersonAdmin> {
  const row = (
    await tx.query(
      `INSERT INTO person (tenant_id, name, short_name, phone, team, kind, title, cell, default_shift, active)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'staff'), $7, $8, $9, true) RETURNING ${PERSON_SELECT}`,
      [tenantId, p.name, p.shortName, p.phone, p.team, p.kind, p.title, p.cell, p.defaultShift].map(
        (v) => v ?? null,
      ),
    )
  ).rows[0];
  return toPerson(row);
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
  const row = (
    await tx.query(
      `UPDATE person SET ${set.join(', ')} WHERE id = $1 RETURNING ${PERSON_SELECT}`,
      values,
    )
  ).rows[0];
  return toPerson(row);
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
       VALUES ($1, $2, $3, $4, $5, $2::uuid IS NULL, $6, true) RETURNING ${LOGIN_SELECT}`,
      [tenantId, l.personId, l.username, passwordHash, l.role, l.cell],
    )
  ).rows[0];
  return toLogin(row);
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
       WHERE id = $1 RETURNING ${LOGIN_SELECT}`,
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
  return toLogin(row);
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

/** Ends every live sign-in of these logins, and every sign-in on a shared login acting as this person. */
export async function endSessions(
  tx: Db,
  who: { loginIds: readonly string[]; actingPersonId?: string },
): Promise<number> {
  const result = await tx.query(
    `UPDATE session SET revoked_at = now(), updated_at = now()
     WHERE revoked_at IS NULL AND (login_id = ANY($1::uuid[]) OR acting_person_id = $2::uuid)`,
    [who.loginIds, who.actingPersonId ?? null],
  );
  return result.rowCount ?? 0;
}

/** Enabled admin logins other than `excluding` whose person (if any) is on: who could still manage people. */
export async function otherAdminCount(tx: Db, excluding: readonly string[]): Promise<number> {
  const row = (
    await tx.query(
      `SELECT count(*)::int AS n FROM login l LEFT JOIN person p ON p.id = l.person_id
       WHERE l.role = 'admin' AND l.disabled_at IS NULL AND (p.id IS NULL OR p.active)
         AND l.id <> ALL($1::uuid[])`,
      [excluding],
    )
  ).rows[0];
  return row.n as number;
}
