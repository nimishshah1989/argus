import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_PASSWORD, SEED_FILES, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

const paths = {
  exportPath: fileURLToPath(
    new URL(
      '../../../docs/discovery/source/cosmos-platform-export-2026-10-28.json',
      import.meta.url,
    ),
  ),
  livePath: fileURLToPath(
    new URL('../../../docs/discovery/bhavin-v3/live-config-2026-11-09.json', import.meta.url),
  ),
  glossaryPath: fileURLToPath(
    new URL('../../../docs/discovery/bhavin-v3/glossary-2026-11-09.json', import.meta.url),
  ),
};

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const files = {
  machines: json(SEED_FILES.machines) as {
    sheetCounts: Record<string, number>;
    machines: Array<{ code: string; segment: string; cell: string | null }>;
  },
  people: json(SEED_FILES.peopleFixture) as {
    users: Array<{ username: string; role: string; shift?: string; name: string }>;
  },
};

let db: TestDb;
let report: Awaited<ReturnType<typeof seedCosmos>>;

async function one<T>(sql: string): Promise<T> {
  return (await db.admin.query(sql)).rows[0] as T;
}

beforeAll(async () => {
  db = await startTestDb();
  report = await seedCosmos(db.admin, paths);
}, 180_000);

afterAll(async () => {
  await db.stop();
});

describe('cosmos real plant seed', () => {
  it('loads every register machine by segment', async () => {
    const bySeg: Record<string, number> = {};
    for (const m of files.machines.machines) bySeg[m.segment] = (bySeg[m.segment] ?? 0) + 1;
    const sc = files.machines.sheetCounts;
    expect(bySeg).toEqual({
      CNC: 125,
      Conventional: 16,
      DG: 3,
      Process: 17,
      Robot: 1,
      Utility: 30,
    });
    expect((bySeg.CNC ?? 0) + (bySeg.Robot ?? 0)).toBe(sc['CNC Machine Master']);
    expect(bySeg.Conventional).toBe(sc['Conventional Machines']);
    expect(bySeg.Process).toBe(sc['Process Machines']);
    expect(bySeg.DG).toBe(sc['DG Sets']);
    expect(bySeg.Utility).toBe(sc.Utilities);
    for (const [segment, n] of Object.entries(bySeg))
      expect(report.counts[`segment_${segment}`]).toBe(n);
    expect(report.counts.machines).toBe(192);
    const cells = await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM machine WHERE cell IS NOT NULL',
    );
    expect(cells.n).toBe(files.machines.machines.filter((m) => m.cell !== null).length);
    const vc = await one<{ cell: string | null }>("SELECT cell FROM machine WHERE code = 'VC-57'");
    expect(vc.cell).toBe(files.machines.machines.find((m) => m.code === 'VC-57')?.cell);
  });

  it('VC-57 carries its nameplate', async () => {
    const vc = await one<Record<string, string | null>>(
      "SELECT make, model, serial FROM machine WHERE code = 'VC-57'",
    );
    expect(vc.make).not.toBeNull();
    expect(vc.model).not.toBeNull();
    expect(vc.serial).not.toBeNull();
  });

  it('seed report lists register differences', () => {
    expect(report.conflicts).toContain('In the 11 Nov registers but not the 28 Oct export: VC-57.');
    expect(report.conflicts).toContain(
      'CNC Machine Master has 126 rows: 125 CNC + 1 Robot (own segment).',
    );
    expect(report.conflicts.some((c) => c.includes('nameplate fields left blank'))).toBe(false);
    expect(report.sources.at(-1)).toBe(SEED_FILES.peopleFixture);
  });

  it('seeds 26 logins with roles, each tied to its own person', async () => {
    const roles = (await db.admin.query('SELECT role, count(*)::int AS n FROM login GROUP BY role'))
      .rows;
    expect(Object.fromEntries(roles.map((r) => [r.role, r.n]))).toEqual({
      technician: 14,
      operator: 11,
      admin: 1,
    });
    const link = await one<{ n: number; people: number; vendors: number }>(
      `SELECT (SELECT count(DISTINCT person_id) FROM login WHERE person_id IS NOT NULL)::int AS n,
              (SELECT count(*) FROM person)::int AS people,
              (SELECT count(*) FROM person p WHERE kind = 'vendor' AND team = 'vendor'
                 AND NOT EXISTS (SELECT 1 FROM login l WHERE l.person_id = p.id))::int AS vendors`,
    );
    expect(link).toEqual({ n: 26, people: 27, vendors: 1 });
    const bad = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM login
       WHERE NOT must_change_password OR shared OR disabled_at IS NOT NULL
          OR password_hash NOT LIKE '$argon2id$%'`,
    );
    expect(bad.n).toBe(0);
    const names = (
      await db.admin.query(
        "SELECT p.name, p.phone FROM person p JOIN login l ON l.person_id = p.id WHERE p.kind <> 'vendor'",
      )
    ).rows;
    expect(names).toHaveLength(26);
    for (const r of names) {
      expect(r.name).toMatch(/^Person \d{2}$/);
      expect(r.phone).toMatch(/^\+9199999000\d{2}$/);
    }
  });

  it('team shifts and default shifts come from the people file', async () => {
    const expected = Object.fromEntries(
      files.people.users.filter((u) => u.shift).map((u) => [u.name, u.shift]),
    );
    expect(Object.keys(expected)).toHaveLength(14);
    const row = await one<{ value: unknown }>(
      "SELECT value FROM setting WHERE key = 'team_shifts'",
    );
    expect(row.value).toEqual(expected);
    const maint = (
      await db.admin.query("SELECT name, default_shift FROM person WHERE team = 'maintenance'")
    ).rows;
    for (const p of maint) expect(p.default_shift).toBe(expected[p.name] ?? null);
  });

  it("shifts are the data file's windows and re-seeding is idempotent", async () => {
    const rows = (
      await db.admin.query(
        'SELECT code, name, starts_at::text AS s, ends_at::text AS e, crosses_midnight AS x FROM shift ORDER BY code',
      )
    ).rows;
    expect(rows).toEqual([
      { code: '1', name: 'Shift 1', s: '08:00:00', e: '18:30:00', x: false },
      { code: '2', name: 'Shift 2', s: '18:29:00', e: '05:00:00', x: true },
    ]);
    await seedCosmos(db.admin, paths);
    const n = await one<Record<string, number>>(
      `SELECT (SELECT count(*) FROM machine)::int AS machines, (SELECT count(*) FROM login)::int AS logins,
              (SELECT count(*) FROM person)::int AS people, (SELECT count(*) FROM glossary_term)::int AS glossary`,
    );
    expect(n).toEqual({ machines: 192, logins: 26, people: 27, glossary: 144 });
  });

  it('a people file needs an initial password', async () => {
    const withFile = { ...paths, peoplePath: SEED_FILES.peopleFixture };
    await expect(seedCosmos(db.admin, withFile)).rejects.toThrow(
      'seed: SEED_INITIAL_PASSWORD is required with a people file',
    );
    expect((await one<{ n: number }>('SELECT count(*)::int AS n FROM login')).n).toBe(26);
    const ok = await seedCosmos(db.admin, withFile, FIXTURE_PASSWORD);
    expect(ok.sources).toContain('people file (outside repo)');
    expect(ok.sources).not.toContain(SEED_FILES.peopleFixture);
  });

  it('an invalid people entry is rejected without leaking values', async () => {
    const copy = json(SEED_FILES.peopleFixture);
    delete copy.users[3].role;
    const peoplePath = join(mkdtempSync(join(tmpdir(), 'seed-')), 'people.json');
    writeFileSync(peoplePath, JSON.stringify(copy));
    const err = await seedCosmos(db.admin, { ...paths, peoplePath }, FIXTURE_PASSWORD).catch(
      (e: Error) => e,
    );
    expect((err as Error).message).toBe('seed: people entry 3 is invalid (role)');
    expect((err as Error).message).not.toMatch(/person|\+91/);
    const n = await one<Record<string, number>>(
      'SELECT (SELECT count(*) FROM login)::int AS logins, (SELECT count(*) FROM machine)::int AS machines',
    );
    expect(n).toEqual({ logins: 26, machines: 192 });
  });
});
