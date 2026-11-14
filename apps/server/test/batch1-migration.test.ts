import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

// Migration batch 1 on a copy of the real plant (its 275 real, pseudonymised tickets) with a sign-in and a phone
// registration on it: applied, reverted and applied again. Nothing the plant already holds may change.
const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);
const UP = readFileSync(new URL('0013_batch1.sql', MIGRATIONS), 'utf8');
const DOWN = readFileSync(new URL('down/0013_batch1.down.sql', MIGRATIONS), 'utf8');
const HASH = 'a'.repeat(64);
const NAME_HASH = 'b'.repeat(64);

let db: TestDb;
let cosmos = '';
let person = '';
let before: Record<string, string> = {};
let columns: Record<string, string[]> = {};

/** A fingerprint per table over the columns it had before the migration: unchanged data has an unchanged one. */
async function fingerprints(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [table, names] of Object.entries(columns)) {
    const row = `ROW(${names.map((name) => `"${name}"`).join(', ')})::text`;
    const found = await db.admin.query(
      `SELECT count(*)::int AS n, coalesce(md5(string_agg(md5(${row}), ',' ORDER BY md5(${row}))), '') AS h FROM "${table}"`,
    );
    result[table] = `${found.rows[0].n}:${found.rows[0].h}`;
  }
  return result;
}

const erase = (...args: string[]) =>
  db.router.query(`SELECT erase_person(${args.map((_, i) => `$${i + 1}`).join(', ')}) AS r`, args);

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  cosmos = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  );
  await importRealExport(db.app, cosmos, { tickets: fixture.tickets });
  person = (
    await db.admin.query(
      "INSERT INTO person (tenant_id, name, team, phone) VALUES ($1, 'Test Leaver', 'maintenance', '+910000000011') RETURNING id",
      [cosmos],
    )
  ).rows[0].id;
  const login = (
    await db.admin.query(
      "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'test.leaver', 'x', 'technician', false) RETURNING id",
      [cosmos, person],
    )
  ).rows[0].id;
  await db.admin.query(
    "INSERT INTO session (tenant_id, login_id, token_hash, expires_at) VALUES ($1, $2, 'tok-1', now() + interval '1 day')",
    [cosmos, login],
  );
  await db.admin.query(
    "INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint) VALUES ($1, $2, $3, 'https://push.example/legacy')",
    [cosmos, login, person],
  );
  // The seeding code already knows the new columns, so the copy is loaded on the full schema and taken back to 0012's.
  await db.admin.query(DOWN);
  const tables = await db.admin.query(
    `SELECT c.table_name AS t, array_agg(c.column_name::text ORDER BY c.ordinal_position) AS cols
       FROM information_schema.columns c JOIN information_schema.tables x
         ON x.table_schema = c.table_schema AND x.table_name = c.table_name AND x.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' GROUP BY c.table_name`,
  );
  columns = Object.fromEntries(tables.rows.map((row) => [row.t, row.cols]));
  before = await fingerprints();
}, 300_000);

afterAll(async () => {
  await db.stop();
});

describe('applying batch 1 to the real plant', () => {
  it('gives up after 5 seconds of waiting for a lock, in both directions, so a stuck deploy fails', () => {
    for (const sql of [UP, DOWN]) expect(sql).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it('changes no row of the 275 real tickets, the people, sign-ins or phone registrations', async () => {
    expect(Number(before.ticket?.split(':')[0])).toBe(275);
    await db.admin.query(UP);
    expect(await fingerprints()).toEqual(before);
  });

  it('refuses to erase a person without a valid hash, and changes nothing', async () => {
    const args = [cosmos, person, 'request-1', 'agent-test'];
    await expect(erase(...args)).rejects.toThrow(/function .* does not exist/);
    await expect(erase(...args, HASH)).rejects.toThrow(/function .* does not exist/);
    await expect(erase(...args, '', NAME_HASH)).rejects.toThrow(/erasure hash is required/);
    await expect(erase(...args, HASH, 'not-a-hash')).rejects.toThrow(/erasure hash is required/);
    expect(await fingerprints()).toEqual(before);
  });

  it('is run by the router role alone: the app role cannot erase', async () => {
    const asApp = db.app.query('SELECT erase_person($1, $2, $3, $4, $5, $6)', [
      cosmos,
      person,
      'request-1',
      'agent-test',
      HASH,
      NAME_HASH,
    ]);
    await expect(asApp).rejects.toThrow(/permission denied/);
  });
});

describe('reverting it', () => {
  it('puts every row back as it was and brings back the four-argument erase_person', async () => {
    await db.admin.query(DOWN);
    expect(await fingerprints()).toEqual(before);
    const found = await db.admin.query(
      "SELECT pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname = 'erase_person'",
    );
    expect(found.rows.map((r) => r.args)).toEqual([
      'p_tenant_id uuid, p_person_id uuid, p_request_ref text, p_operator text',
    ]);
  });

  it('can be applied again after a revert', async () => {
    await db.admin.query(UP);
    expect(await fingerprints()).toEqual(before);
  });
});
