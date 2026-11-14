import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMigratedDb } from './migrated.js';

const A = '70000000-0000-0000-0000-00000000000a';
const B = '70000000-0000-0000-0000-00000000000b';
const LOGO_A = '70000000-0000-0000-0000-0000000000a1';
const PDF_A = '70000000-0000-0000-0000-0000000000a2';
const LOGO_B = '70000000-0000-0000-0000-0000000000b1';

let container: StartedPostgreSqlContainer;
let db: Client;

beforeAll(async () => {
  ({ container, client: db } = await startMigratedDb({ seed: false }));
  await db.query(
    `INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-a', 'Plant A'), ($2, 'plant-b', 'Plant B')`,
    [A, B],
  );
  await db.query(
    `INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256) VALUES
       ($1, $4, 'logo', 'a/logo.png', 'image/png', 1, 'x'),
       ($2, $4, 'pdf', 'a/doc.pdf', 'application/pdf', 1, 'x'),
       ($3, $5, 'logo', 'b/logo.png', 'image/png', 1, 'x')`,
    [LOGO_A, PDF_A, LOGO_B, A, B],
  );
}, 120_000);
afterAll(async () => {
  await db.end();
  await container.stop();
});

/** Runs `sql` as the application role (`app_user`), the way a request does, with the plant it is in. */
async function asApp(scope: string | null | undefined, sql: string, params: unknown[] = []) {
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE app_user');
    if (scope !== undefined)
      await db.query("SELECT set_config('app.tenant_id', $1, true)", [scope]);
    return await db.query(sql, params);
  } finally {
    await db.query('ROLLBACK');
  }
}
const profile = async (id: string) =>
  (await db.query('SELECT name, language, time_zone, logo_file_id FROM tenant WHERE id = $1', [id]))
    .rows[0];

describe('tenant_update_profile', () => {
  it("changes the signed-in plant's name, language and time zone and nothing of another plant", async () => {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE app_user');
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [A]);
    await db.query("SELECT tenant_update_profile('Plant A Ltd', 'gu', 'Asia/Dubai')");
    await db.query('RESET ROLE');
    expect(await profile(A)).toMatchObject({
      name: 'Plant A Ltd',
      language: 'gu',
      time_zone: 'Asia/Dubai',
    });
    expect(await profile(B)).toMatchObject({
      name: 'Plant B',
      language: 'en',
      time_zone: 'Asia/Kolkata',
    });
    await db.query('ROLLBACK');
  });

  it('a NULL argument leaves that value as it is', async () => {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE app_user');
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [A]);
    await db.query("SELECT tenant_update_profile(NULL, 'hi', NULL)");
    await db.query('RESET ROLE');
    expect(await profile(A)).toMatchObject({
      name: 'Plant A',
      language: 'hi',
      time_zone: 'Asia/Kolkata',
    });
    await db.query('ROLLBACK');
  });

  it.each([
    ['no plant in scope', undefined],
    ['an empty plant', ''],
    ['a plant that is not a uuid', 'not-a-uuid'],
  ])('stops when there is %s, and changes nothing', async (_label, scope) => {
    await expect(
      asApp(scope, "SELECT tenant_update_profile('Hijacked', NULL, NULL)"),
    ).rejects.toThrow();
    expect((await profile(A)).name).toBe('Plant A');
    expect((await profile(B)).name).toBe('Plant B');
  });

  it('refuses an empty name, an unsupported language and an unknown time zone', async () => {
    for (const args of ["'  ', NULL, NULL", "NULL, 'fr', NULL", "NULL, NULL, 'Mars/Olympus'"]) {
      await expect(asApp(A, `SELECT tenant_update_profile(${args})`), args).rejects.toThrow();
    }
  });

  it('cannot be bypassed by writing the table directly, and a search_path hijack changes nothing', async () => {
    await expect(asApp(A, "UPDATE tenant SET name = 'x' WHERE id = $1", [A])).rejects.toThrow(
      /permission denied/,
    );
    await db.query('CREATE SCHEMA evil');
    await db.query(
      'CREATE TABLE evil.tenant (id uuid, name text, language text, time_zone text, updated_at timestamptz)',
    );
    await db.query('GRANT USAGE ON SCHEMA evil TO app_user');
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE app_user');
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [A]);
    await db.query('SET LOCAL search_path = evil, public');
    await db.query("SELECT tenant_update_profile('Real change', NULL, NULL)");
    await db.query('RESET ROLE');
    await db.query('SET LOCAL search_path = public'); // our own check must not read the decoy
    expect((await profile(A)).name).toBe('Real change');
    expect((await db.query('SELECT count(*)::int AS n FROM evil.tenant')).rows[0].n).toBe(0);
    await db.query('ROLLBACK');
  });
});

describe('tenant_set_logo and tenant_logo', () => {
  it("points the plant at its own logo, never at another plant's file or another kind of file", async () => {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE app_user');
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [A]);
    await db.query('SELECT tenant_set_logo($1)', [LOGO_A]);
    await db.query('RESET ROLE');
    expect((await profile(A)).logo_file_id).toBe(LOGO_A);
    await db.query('ROLLBACK');
    await expect(asApp(A, 'SELECT tenant_set_logo($1)', [LOGO_B])).rejects.toThrow(
      /not a logo of this plant/,
    );
    await expect(asApp(A, 'SELECT tenant_set_logo($1)', [PDF_A])).rejects.toThrow(
      /not a logo of this plant/,
    );
    await expect(asApp(undefined, 'SELECT tenant_set_logo($1)', [LOGO_A])).rejects.toThrow();
    expect((await profile(A)).logo_file_id).toBeNull();
  });

  it('tenant_logo gives a company its own logo only, and nothing for a suspended company', async () => {
    await db.query('UPDATE tenant SET logo_file_id = $1 WHERE id = $2', [LOGO_A, A]);
    await db.query('UPDATE tenant SET logo_file_id = $1 WHERE id = $2', [LOGO_B, B]);
    expect((await asApp(undefined, "SELECT tenant_logo('plant-a') AS id")).rows[0].id).toBe(LOGO_A);
    expect((await asApp(undefined, "SELECT tenant_logo('plant-b') AS id")).rows[0].id).toBe(LOGO_B);
    expect((await asApp(undefined, "SELECT tenant_logo('nobody') AS id")).rows[0].id).toBeNull();
    await db.query("UPDATE tenant SET status = 'suspended' WHERE id = $1", [A]);
    expect((await asApp(undefined, "SELECT tenant_logo('plant-a') AS id")).rows[0].id).toBeNull();
    await db.query("UPDATE tenant SET status = 'active', logo_file_id = NULL");
  });
});

describe('who may run them', () => {
  it('all three are owned by app_router, pin their search_path and are executable by app_user only', async () => {
    const rows = (
      await db.query(
        `SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig,
                has_function_privilege('app_user', p.oid, 'execute') AS app_user_may
           FROM pg_proc p WHERE p.proname IN ('tenant_update_profile', 'tenant_set_logo', 'tenant_logo')
           ORDER BY 1`,
      )
    ).rows;
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r).toMatchObject({ owner: 'app_router', prosecdef: true, app_user_may: true });
      expect(r.proconfig).toContain('search_path=public, pg_temp');
    }
  });

  it('a role that is not app_user cannot run them', async () => {
    await db.query('CREATE ROLE stranger NOLOGIN');
    for (const call of [
      "tenant_logo('plant-a')",
      "tenant_update_profile('x', NULL, NULL)",
      'tenant_set_logo(NULL)',
    ]) {
      await db.query('BEGIN');
      await db.query('SET LOCAL ROLE stranger');
      await expect(db.query(`SELECT ${call}`), call).rejects.toThrow(/permission denied/);
      await db.query('ROLLBACK');
    }
  });
});
