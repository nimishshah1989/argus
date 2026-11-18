import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_PASSWORD, SEED_FILES, assertSeedAllowed, seedCosmos } from '../src/seed/cosmos.js';
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

  it('loads the workbook PM plan as one recurring plan per machine', async () => {
    expect(report.counts).toMatchObject({
      pm_plan_source_rows: 427,
      pm_plan_visits: 427,
      pm_plans: 125,
      pm_plan_done: 15,
      pm_plan_checklists: 2,
    });
    const counts = await one<Record<string, number>>(
      `SELECT (SELECT count(*) FROM pm_plan)::int AS plans,
              (SELECT count(*) FROM pm_plan WHERE last_done_on IS NOT NULL)::int AS done,
              (SELECT count(*) FROM pm_plan WHERE jsonb_array_length(checklist) > 0)::int AS checklists,
              (SELECT count(*) FROM ticket)::int AS tickets,
              (SELECT count(*) FROM breakdown_report)::int AS reports`,
    );
    expect(counts).toEqual({ plans: 125, done: 15, checklists: 2, tickets: 0, reports: 0 });
    const titled = await one<{ bad: number }>(
      `SELECT count(*)::int AS bad FROM pm_plan p JOIN machine m ON m.id = p.machine_id
        WHERE p.title <> m.code || ' preventive maintenance'`,
    );
    expect(titled.bad).toBe(0);
    const vc = await one<{ items: number; anchor: string; done: string }>(
      `SELECT jsonb_array_length(p.checklist)::int AS items,
              to_char(p.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS anchor,
              p.last_done_on::text AS done
         FROM pm_plan p JOIN machine m ON m.id = p.machine_id WHERE m.code = 'VC-6'`,
    );
    // VC-6's latest done date is 2026-10-19 (it has two done rows); the plan anchors there.
    expect(vc).toEqual({ items: 47, anchor: '2026-10-19', done: '2026-10-19' });
    const future = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM pm_plan
        WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date > DATE '2026-11-11'`,
    );
    expect(future.n).toBeGreaterThan(0);
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
              (SELECT count(*) FROM person p WHERE team = 'vendor'
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
        "SELECT p.name, p.phone FROM person p JOIN login l ON l.person_id = p.id WHERE p.team <> 'vendor'",
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
              (SELECT count(*) FROM person)::int AS people, (SELECT count(*) FROM glossary_term)::int AS glossary,
              (SELECT count(*) FROM pm_plan)::int AS pm_plans`,
    );
    expect(n).toEqual({ machines: 192, logins: 26, people: 27, glossary: 144, pm_plans: 125 });
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

  it('refuses to replace a Cosmos that already holds tickets, and says so without changing anything', async () => {
    const tenant = await one<{ id: string }>("SELECT id FROM tenant WHERE slug = 'cosmos'");
    await db.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, 'BD-0001', 'stopped', 'open', 'Imported breakdown', now(), 'S3')`,
      [tenant.id],
    );
    const before = await one<Record<string, number>>(
      `SELECT (SELECT count(*) FROM ticket)::int AS tickets, (SELECT count(*) FROM person)::int AS people,
              (SELECT count(*) FROM machine)::int AS machines`,
    );
    await expect(seedCosmos(db.admin, paths)).rejects.toThrow(/already holds 1 ticket/);
    expect(
      await one<Record<string, number>>(
        `SELECT (SELECT count(*) FROM ticket)::int AS tickets, (SELECT count(*) FROM person)::int AS people,
                (SELECT count(*) FROM machine)::int AS machines`,
      ),
    ).toEqual(before);
    expect((await one<{ id: string }>("SELECT id FROM tenant WHERE slug = 'cosmos'")).id).toBe(
      tenant.id,
    );
    // An empty Cosmos is still replaced, as dev and CI rely on.
    await db.admin.query('DELETE FROM ticket WHERE tenant_id = $1', [tenant.id]);
    await expect(seedCosmos(db.admin, paths)).resolves.toBeTruthy();
  });

  it('seeds as a login that row security applies to, as the database owner on RDS is', async () => {
    // RDS's master login is not a superuser: row security filters it like any role unless the seed names the tenant.
    await db.admin.query(
      `DROP ROLE IF EXISTS seed_like;
       CREATE ROLE seed_like LOGIN PASSWORD 'seed-like-pw' NOSUPERUSER NOBYPASSRLS;
       GRANT app_user TO seed_like;
       GRANT SELECT, INSERT, UPDATE, DELETE ON tenant TO seed_like`,
    );
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: `postgresql://seed_like:seed-like-pw@${db.container.getHost()}:${db.container.getPort()}/${db.container.getDatabase()}`,
    });
    try {
      const report = await seedCosmos(pool, paths);
      expect(report.counts.machines).toBe(192);
    } finally {
      await pool.end();
    }
    const n = await one<Record<string, number>>(
      'SELECT (SELECT count(*) FROM machine)::int AS machines, (SELECT count(*) FROM login)::int AS logins',
    );
    expect(n).toEqual({ machines: 192, logins: 26 });
  });

  describe('what a re-seed may destroy', () => {
    const cosmosId = async () =>
      (await one<{ id: string }>("SELECT id FROM tenant WHERE slug = 'cosmos'")).id;
    const rows = async () =>
      one<Record<string, number>>(
        `SELECT (SELECT count(*) FROM person)::int AS people, (SELECT count(*) FROM machine)::int AS machines`,
      );

    it('refuses a suspended Cosmos that holds tickets (a lookup by slug alone would not see it)', async () => {
      const id = await cosmosId();
      await db.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity)
         VALUES ($1, 'BD-0001', 'stopped', 'open', 'x', now(), 'S3')`,
        [id],
      );
      await db.admin.query("UPDATE tenant SET status = 'suspended' WHERE id = $1", [id]);
      const before = await rows();
      await expect(seedCosmos(db.admin, paths)).rejects.toThrow(/already holds 1 ticket/);
      expect(await rows()).toEqual(before);
      expect(await cosmosId()).toBe(id);
      await db.admin.query('DELETE FROM ticket WHERE tenant_id = $1', [id]);
      await db.admin.query("UPDATE tenant SET status = 'active' WHERE id = $1", [id]);
    });

    it('refuses a Cosmos with no tickets left but import history or audit rows: that is the undo proof', async () => {
      const id = await cosmosId();
      await db.admin.query(
        "INSERT INTO import_batch (tenant_id, source, status) VALUES ($1, 'bhavin', 'undone')",
        [id],
      );
      await expect(seedCosmos(db.admin, paths)).rejects.toThrow(/1 import batch/);
      await db.admin.query('DELETE FROM import_batch WHERE tenant_id = $1', [id]);
      await db.admin.query(
        "INSERT INTO audit_log (tenant_id, action, entity) VALUES ($1, 'import.undo', 'import_batch')",
        [id],
      );
      await expect(seedCosmos(db.admin, paths)).rejects.toThrow(/1 audit row/);
      expect(await cosmosId()).toBe(id);
      await db.admin.query('DELETE FROM audit_log WHERE tenant_id = $1', [id]);
    });

    it('replaces a Cosmos with history only when asked in so many words', async () => {
      const id = await cosmosId();
      await db.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity)
         VALUES ($1, 'BD-0001', 'stopped', 'open', 'x', now(), 'S3')`,
        [id],
      );
      await expect(seedCosmos(db.admin, paths)).rejects.toThrow(/already holds/);
      await seedCosmos(db.admin, paths, undefined, { replace: true });
      expect((await one<{ n: number }>('SELECT count(*)::int AS n FROM ticket')).n).toBe(0);
      expect(await cosmosId()).not.toBe(id);
    });

    it('checks and deletes under one lock: a ticket raised while the seed waits is still seen', async () => {
      const id = await cosmosId();
      const other = await db.admin.connect();
      try {
        await other.query('BEGIN');
        await other.query('SELECT id FROM tenant WHERE id = $1 FOR UPDATE', [id]);
        const seeding = seedCosmos(db.admin, paths).catch((error: Error) => error);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await other.query(
          `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity)
           VALUES ($1, 'BD-0001', 'stopped', 'open', 'x', now(), 'S3')`,
          [id],
        );
        await other.query('COMMIT');
        expect(((await seeding) as Error).message).toMatch(/already holds 1 ticket/);
      } finally {
        other.release();
      }
      expect(await cosmosId()).toBe(id);
      await db.admin.query('DELETE FROM ticket WHERE tenant_id = $1', [id]);
    });
  });

  it('the fake fixture people never seed a shared server', () => {
    expect(() => assertSeedAllowed({ APP_ENV: 'staging' })).toThrow(/SEED_PEOPLE_FILE/);
    expect(() => assertSeedAllowed({ APP_ENV: 'production' })).toThrow(/SEED_PEOPLE_FILE/);
    expect(() =>
      assertSeedAllowed({ APP_ENV: 'staging', SEED_PEOPLE_FILE: 'x.json' }),
    ).not.toThrow();
    expect(() => assertSeedAllowed({})).not.toThrow();
  });
});
