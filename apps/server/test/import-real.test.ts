import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ImportFatalError } from '../src/modules/imports/batch.js';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { undoImport } from '../src/modules/imports/undo.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { APP_API_PASSWORD, startTestDb, type TestDb } from './harness.js';

const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const paths = {
  exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
  livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
  glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
};
const fixture = (): { tickets: Array<Record<string, unknown>> } =>
  JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  );

let db: TestDb;
let tenantId: string;
let app: Awaited<ReturnType<typeof buildApp>>;
let first: Awaited<ReturnType<typeof importRealExport>>;

const count = async (sql: string): Promise<number> =>
  Number((await db.admin.query(sql, [tenantId])).rows[0].n);

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, paths);
  tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  first = await importRealExport(db.app, tenantId, fixture());
}, 240_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('Bhavin export in', () => {
  it('imports every ticket with his numbers and proves them', async () => {
    expect(first.stats).toMatchObject({ status: 'done', tickets: 275, imported: 275, skipped: 0 });
    expect(first.stats.figures.unexplained).toBe(0);
    expect(first.stats.figures.edit).toBeGreaterThan(0);
    const stored = (
      await db.admin.query(
        `SELECT ref, response_min, active_min, wait_min, vendor_min, handover_wait_min, down_acc_min,
                downtime_min, follow_min, repair_min FROM ticket WHERE tenant_id = $1`,
        [tenantId],
      )
    ).rows;
    const byRef = new Map(stored.map((r) => [r.ref as string, r]));
    for (const t of fixture().tickets) {
      const row = byRef.get(t.ref as string);
      expect(row, String(t.ref)).toBeDefined();
      expect([
        row.response_min,
        row.active_min,
        row.wait_min,
        row.vendor_min,
        row.handover_wait_min,
        row.down_acc_min,
        row.downtime_min,
        row.follow_min,
        row.repair_min,
      ]).toEqual([
        t.responseMin,
        t.activeMin,
        t.waitMin,
        t.vendorMin,
        t.handoverWaitMin,
        t.downAcc,
        t.downtimeMin,
        t.followMin,
        t.repairMin,
      ]);
    }
  });

  it('keeps statuses, work stretches and his lead and task events', async () => {
    const by = async (status: string) =>
      count(`SELECT count(*) n FROM ticket WHERE tenant_id = $1 AND status = '${status}'`);
    expect([await by('closed'), await by('cancelled'), await by('open')]).toEqual([211, 54, 7]);
    expect(
      await count(`SELECT count(*) n FROM ticket_event WHERE tenant_id = $1 AND type = 'lead'`),
    ).toBe(1);
    expect(
      await count(`SELECT count(*) n FROM ticket_event WHERE tenant_id = $1 AND type = 'task'`),
    ).toBe(5);
    expect(
      await count(`SELECT count(*) n FROM ticket_event WHERE tenant_id = $1 AND type = 'segment'`),
    ).toBe(0);
    expect(await count('SELECT count(*) n FROM work_segment WHERE tenant_id = $1')).toBeGreaterThan(
      200,
    );
  });

  it('shows the imported tickets on the desk', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: { username: 'person01', password: FIXTURE_PASSWORD },
    });
    const token = login.json().token as string;
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets?limit=5',
      headers: { host: 'cosmos.localhost', authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toMatch(/BD-|WR-/);
  });

  it('a re-run is identical', async () => {
    const before = await count('SELECT count(*) n FROM ticket WHERE tenant_id = $1');
    const again = await importRealExport(db.app, tenantId, fixture());
    expect(again.stats).toMatchObject({ status: 'done', imported: 0, skipped: 275 });
    expect(await count('SELECT count(*) n FROM ticket WHERE tenant_id = $1')).toBe(before);
    expect(await count('SELECT count(*) n FROM ticket_event WHERE tenant_id = $1')).toBe(
      first.stats.events,
    );
  });

  it('refuses a stored number that nothing explains, and writes nothing more', async () => {
    const planted = fixture();
    const target = planted.tickets.find((t) => t.status === 'closed' && t.kind === 'stopped')!;
    target.repairMin = (target.repairMin as number) + 7;
    await expect(importRealExport(db.app, tenantId, planted)).rejects.toBeInstanceOf(
      ImportFatalError,
    );
    const failed = await db.admin.query(
      `SELECT status FROM import_batch WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [tenantId],
    );
    expect(failed.rows[0].status).toBe('failed');
    expect(await count('SELECT count(*) n FROM ticket WHERE tenant_id = $1')).toBe(275);
  });

  it('undo leaves no row, and cannot run twice', async () => {
    await expect(undoImport(db.router, tenantId, first.batchId, 'operator')).resolves.toEqual({
      deleted: 275,
    });
    for (const table of [
      'ticket',
      'ticket_event',
      'work_segment',
      'crew_member',
      'breakdown_report',
    ]) {
      expect(await count(`SELECT count(*) n FROM ${table} WHERE tenant_id = $1`), table).toBe(0);
    }
    await expect(undoImport(db.router, tenantId, first.batchId, 'operator')).rejects.toThrow();
  });
});

describe('the operator CLI takes his export unchanged', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync('pnpm', ['--silent', ...args], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'staging', ...env },
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 16_777_216,
    });

  it('imports the file, then undoes the batch', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'real-export-')), 'export.json');
    writeFileSync(file, JSON.stringify(fixture()));
    const url = new URL(db.routerUrl);
    url.username = 'app_api';
    url.password = APP_API_PASSWORD;
    const imported = run(['import:bhavin', file, '--tenant', 'cosmos'], { DATABASE_URL: url.href });
    expect(imported.status, imported.stderr).toBe(0);
    const out = JSON.parse(imported.stdout.trim().split('\n').pop() as string);
    expect(out.stats).toMatchObject({ status: 'done', imported: 275, skipped: 0 });
    const undone = run(
      ['import:undo', out.batchId, '--tenant', 'cosmos', '--operator', 'operator'],
      { ROUTER_DATABASE_URL: db.routerUrl },
    );
    expect(undone.status, undone.stderr).toBe(0);
    expect(JSON.parse(undone.stdout.trim())).toEqual({ batchId: out.batchId, deleted: 275 });
  }, 240_000);
});
