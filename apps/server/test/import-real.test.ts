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

  it('shows his stored minutes on the ticket detail, not a recompute', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost' },
      payload: { username: 'person01', password: FIXTURE_PASSWORD },
    });
    const headers = { host: 'cosmos.localhost', authorization: `Bearer ${login.json().token}` };
    const ids = new Map(
      (
        await db.admin.query('SELECT ref, id FROM ticket WHERE tenant_id = $1', [tenantId])
      ).rows.map((r) => [r.ref as string, r.id as string]),
    );
    const wrong: string[] = [];
    for (const t of fixture().tickets.filter((x) => x.status === 'closed')) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/${ids.get(t.ref as string)}`,
        headers,
      });
      const f = res.json().ticket.figures;
      const got = [
        f.responseMin,
        f.activeMin,
        f.waitMin,
        f.vendorMin,
        f.handoverWaitMin,
        f.downAccMin,
        f.downtimeMin,
        f.followMin,
        f.repairMin,
      ];
      const his = [
        t.responseMin,
        t.activeMin,
        t.waitMin,
        t.vendorMin,
        t.handoverWaitMin,
        t.downAcc,
        t.downtimeMin,
        t.followMin,
        t.repairMin ?? 0,
      ];
      if (JSON.stringify(got) !== JSON.stringify(his))
        wrong.push(`${t.ref}: his ${his}, shown ${got}`);
    }
    expect(wrong).toEqual([]);
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

describe('erasing a person from an imported batch', () => {
  // Words of the person's name inside the ticket text that erase_person rewrites (and that undo's fingerprint covers).
  const IN_TICKET_TEXT = String.raw`EXISTS (SELECT 1 FROM ticket t WHERE t.tenant_id = p.tenant_id
    AND (concat_ws(' ', t.problem, t.close_note, t.waiting_spare, t.task_reason, t.location)
         ~* ('(^|[[:space:][:punct:]])' || regexp_replace(p.name, '([^[:alnum:][:space:]])', '\\\1', 'g') || '([[:space:][:punct:]]|$)')
         OR t.overrides::text ILIKE '%' || p.name || '%'))`;

  /** The first person (by id, so the same one every run) named in the raw rows, with or without a ticket's text. */
  async function personNamedInRawRows(inTicketText: boolean): Promise<string> {
    const found = await db.admin.query(
      `SELECT p.id FROM person p
       WHERE p.tenant_id = $1 AND length(p.name) >= 4 AND p.name <> 'Former staff'
         AND EXISTS (SELECT 1 FROM import_row r WHERE r.tenant_id = p.tenant_id AND r.payload::text ILIKE '%' || p.name || '%')
         AND ${inTicketText ? '' : 'NOT '}${IN_TICKET_TEXT}
       ORDER BY p.id LIMIT 1`,
      [tenantId],
    );
    expect(
      found.rows,
      `the fixture has a person named in raw rows, ${inTicketText ? 'and' : 'but not'} in ticket text`,
    ).toHaveLength(1);
    return found.rows[0].id as string;
  }

  async function erase(personId: string, ref: string): Promise<{ ticket: number }> {
    const out = await db.router.query('SELECT erase_person($1, $2, $3, $4) AS counts', [
      tenantId,
      personId,
      ref,
      'operator',
    ]);
    return out.rows[0].counts as { ticket: number };
  }

  it('lets undo go ahead when the person was named only in the raw rows', async () => {
    const batch = await importRealExport(db.app, tenantId, fixture());
    expect(batch.stats).toMatchObject({ status: 'done', imported: 275, skipped: 0 });
    const counts = await erase(await personNamedInRawRows(false), 'request-real-0001');
    expect(counts.ticket, 'no ticket text was rewritten, so history is as imported').toBe(0);
    expect(
      await count(
        `SELECT count(*) n FROM import_row WHERE tenant_id = $1 AND payload = '{}'::jsonb`,
      ),
      'erasure emptied at least one raw envelope',
    ).toBeGreaterThan(0);
    await expect(undoImport(db.router, tenantId, batch.batchId, 'operator')).resolves.toEqual({
      deleted: 275,
    });
    expect(await count('SELECT count(*) n FROM ticket WHERE tenant_id = $1')).toBe(0);
  }, 120_000);

  it('leaves the export importable again, and refuses an undo it can no longer verify, saying why', async () => {
    const batch = await importRealExport(db.app, tenantId, fixture());
    expect(batch.stats).toMatchObject({ status: 'done', imported: 275, skipped: 0 });
    const personId = await personNamedInRawRows(true);
    const name = (await db.admin.query('SELECT name FROM person WHERE id = $1', [personId])).rows[0]
      .name as string;
    const counts = await erase(personId, 'request-real-0002');
    expect(counts.ticket, 'erasure rewrote the name inside ticket text').toBeGreaterThan(0);
    expect(
      await count(
        `SELECT count(*) n FROM import_row WHERE tenant_id = $1 AND payload = '{}'::jsonb`,
      ),
      'erasure emptied at least one raw envelope',
    ).toBeGreaterThan(0);

    const again = await importRealExport(db.app, tenantId, fixture());
    expect(again.stats).toMatchObject({ status: 'done', imported: 0, skipped: 275 });
    const written = await db.admin.query(
      `SELECT count(*)::int AS n FROM import_row WHERE tenant_id = $1 AND payload::text ILIKE '%' || $2 || '%'`,
      [tenantId, name],
    );
    expect(written.rows[0].n, 'the re-import wrote the erased name back').toBe(0);

    const moved = fixture();
    (moved.tickets[0] as { ref: string }).ref = 'BD-9999';
    await expect(importRealExport(db.app, tenantId, moved)).rejects.toBeInstanceOf(
      ImportFatalError,
    );

    await expect(undoImport(db.router, tenantId, batch.batchId, 'operator')).rejects.toThrow(
      /erasing a person/i,
    );
    expect(await count('SELECT count(*) n FROM ticket WHERE tenant_id = $1')).toBe(275);
  }, 120_000);
});
