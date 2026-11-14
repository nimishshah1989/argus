import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

// The M4a migration (0014) on a copy of the real plant (its 275 real, pseudonymised tickets), with values planted in the
// three columns it drops: applied, reverted, applied again. Everything the plant holds that the migration does not
// drop must stay exactly as it was, and the revert must put the dropped values back.
const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);
const UP = readFileSync(new URL('0014_m4a_schema.sql', MIGRATIONS), 'utf8');
const DOWN = readFileSync(new URL('down/0014_m4a_schema.down.sql', MIGRATIONS), 'utf8');
const DROPPED: Record<string, string[]> = {
  person: ['kind'],
  ticket: ['sla_policy_id', 'handback_status'],
};

let db: TestDb;
let cosmos = '';
let before: Record<string, string> = {};
let columns: Record<string, string[]> = {};

/** A fingerprint per table over the named columns: unchanged data has an unchanged one. The migration's own audit lines are the one addition it may make. */
async function fingerprints(
  without: Record<string, string[]> = {},
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [table, all] of Object.entries(columns)) {
    const names = all.filter((name) => !without[table]?.includes(name));
    const row = `ROW(${names.map((name) => `"${name}"`).join(', ')})::text`;
    const found = await db.admin.query(
      `SELECT count(*)::int AS n, coalesce(md5(string_agg(md5(${row}), ',' ORDER BY md5(${row}))), '') AS h FROM "${table}" ${table === 'audit_log' ? "WHERE action <> 'migration.0014'" : ''}`,
    );
    result[table] = `${found.rows[0].n}:${found.rows[0].h}`;
  }
  return result;
}

let beforeKept: Record<string, string> = {};

beforeAll(async () => {
  db = await startTestDb({ through: '0013_batch1.sql' });
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
  // Values in the three retired columns, as a database that was written to by hand or by an old build could hold.
  const policy = (
    await db.admin.query(
      "INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes) VALUES ($1, 'S1', 5, 30) RETURNING id",
      [cosmos],
    )
  ).rows[0].id;
  await db.admin.query(
    "UPDATE ticket SET sla_policy_id = $2, handback_status = 'confirmed' WHERE id = (SELECT id FROM ticket WHERE tenant_id = $1 ORDER BY ref LIMIT 1)",
    [cosmos, policy],
  );
  await db.admin.query(
    "UPDATE person SET kind = 'vendor' WHERE id = (SELECT id FROM person WHERE tenant_id = $1 ORDER BY name LIMIT 1)",
    [cosmos],
  );
  const tables = await db.admin.query(
    `SELECT c.table_name AS t, array_agg(c.column_name::text ORDER BY c.ordinal_position) AS cols
       FROM information_schema.columns c JOIN information_schema.tables x
         ON x.table_schema = c.table_schema AND x.table_name = c.table_name AND x.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' GROUP BY c.table_name`,
  );
  columns = Object.fromEntries(tables.rows.map((row) => [row.t, row.cols]));
  before = await fingerprints();
  beforeKept = await fingerprints(DROPPED);
}, 300_000);

afterAll(async () => {
  await db.stop();
});

describe('applying the M4a migration to the real plant', () => {
  it('gives up after 5 seconds of waiting for a lock, in both directions, so a stuck deploy fails', () => {
    for (const sql of [UP, DOWN]) expect(sql).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it('changes no value of the 275 real tickets or the people beyond dropping the three retired columns', async () => {
    expect(Number(before.ticket?.split(':')[0])).toBe(275);
    await db.admin.query(UP);
    expect(await fingerprints(DROPPED)).toEqual(beforeKept);
  });

  it('saves the planted values of the dropped columns before dropping them, and nothing else', async () => {
    const line = (
      await db.admin.query(
        "SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'migration.0014'",
        [cosmos],
      )
    ).rows[0].after;
    expect(Object.values(line.person_kind)).toEqual(['vendor']);
    expect(Object.values(line.ticket_handback_status)).toEqual(['confirmed']);
    expect(Object.keys(line.ticket_sla_policy_id)).toHaveLength(1);
  });
});

describe('reverting it', () => {
  it('puts every row back as it was, the dropped values included', async () => {
    await db.admin.query(DOWN);
    expect(await fingerprints()).toEqual(before);
  });

  it('can be applied again after a revert, and reverted again after that', async () => {
    await db.admin.query(UP);
    expect(await fingerprints(DROPPED)).toEqual(beforeKept);
    await db.admin.query(DOWN);
    expect(await fingerprints()).toEqual(before);
  });
});
