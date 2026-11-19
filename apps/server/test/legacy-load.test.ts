/**
 * Ticket 69c: the converter's fixture (invented workbooks, sentinel names) goes through the converter and the real
 * importer into a Cosmos-seeded tenant, year by year, and the engine runs over each year with an explicit period.
 * Hand values: the 69b fixture plus one January 2022 row on S-1 (so February and March are a real gap) and one
 * October 2022 power-cut row on S-1 (a month with a plant event and no breakdown).
 *   2022 file: 15 tickets (14 + January) and 3 events (10 Aug, 11 Aug, 5 Oct); 2023 file: 4 tickets, one of them a
 *   late-2022 row dated 15 Dec 2022. The engine counts every report: 2022 = 16 (15 with downtime + 1 blank-minute
 *   row), 2023 = 3. The summary sheets' rule (R7: minutes above 0) counts 15 in 2022.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { DEFAULT_SWITCHES, type Switches } from '../src/seed/legacy-classify.js';
import { convertLegacy } from '../src/seed/legacy-export.js';
import { KNOWN, fixtureRows, serial, sheet } from '../src/seed/legacy-fixture.js';
import { withTenant } from '@uptimo/db';
import { ensureLegacyListEntries } from '../src/modules/plant/index.js';
import {
  assertLocalUrl,
  connect,
  engineData,
  figureOf,
  loadLegacyYears,
  runYear,
  workbookYears,
} from '../src/seed/legacy-load.js';
import { loadedFigures } from '../../../tools/legacy-check.js';
import { readSheet, type LegacyRow } from '../src/seed/legacy-sheets.js';
import { startTestDb, type TestDb } from './harness.js';

const SENTINELS = ['Zorbo', 'Quixle', 'Vimpl', 'Narden'];
const SWITCHES: Switches = { ...DEFAULT_SWITCHES, star: {} };
const TILE = 'dashboard.total-breakdowns';

function rows(): LegacyRow[] {
  const extra = (machine: string, grid: ReturnType<typeof sheet>): LegacyRow[] =>
    readSheet(2022, machine, grid, KNOWN)?.rows ?? [];
  return [
    ...fixtureRows(),
    ...extra(
      'S-1',
      sheet([
        { date: serial('2022-01-10'), minutes: 60, code: 'E', em: 'E' },
        { date: serial('2022-10-05'), problem: 'Power cut', code: 'UTI', em: 'E', uti: 1 },
      ]),
    ),
  ];
}

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let tenantId: string;
let token: string;
let converted: ReturnType<typeof convertLegacy>;
let loaded: Awaited<ReturnType<typeof loadLegacyYears>>;

const q = (text: string, params: unknown[] = []) => db.admin.query(text, params);
const count = async (sql: string): Promise<number> =>
  ((await q(sql, [tenantId])).rows[0] as { n: number }).n;
const get = (url: string) =>
  app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', authorization: `Bearer ${token}` },
  });
const doc = (path: string): string =>
  new URL(`../../../docs/discovery/${path}`, import.meta.url).pathname;
const tenantInfo = async () => ({ id: tenantId, timeZone: 'Asia/Kolkata' });

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  tenantId = (await q("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id as string;
  await q(
    `INSERT INTO machine (tenant_id, code, category, cell)
     SELECT $1, code, 'CNC', 'Cell-1' FROM unnest($2::text[]) AS t(code)
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [tenantId, ['ZZ-1', 'ZZ-2', 'ZZ-3', 'ZZ-4', 'S-1']],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: {
      username: (
        await q(
          "SELECT username FROM login WHERE tenant_id = $1 AND role = 'admin' ORDER BY username LIMIT 1",
          [tenantId],
        )
      ).rows[0].username as string,
      password: FIXTURE_PASSWORD,
    },
  });
  token = login.json().token as string;
  const plant = { machines: KNOWN, people: [], terms: [] };
  converted = convertLegacy(rows(), plant, SWITCHES);
  loaded = await loadLegacyYears(db.app, await tenantInfo(), converted.files);
}, 240_000);

afterAll(async () => {
  await app?.close();
  await db.stop();
});

describe('the converter fixture loaded year by year', () => {
  it('loads two batches done, tickets, events and source refs equal to the converter, and a second load adds 0', async () => {
    expect(converted.reports.map((r) => [r.year, r.tickets, r.events, r.identity])).toEqual([
      [2022, 15, 3, true],
      [2023, 4, 0, true],
    ]);
    expect(loaded.map((l) => [l.year, l.status, l.imported, l.errored])).toEqual([
      [2022, 'done', 18, 0],
      [2023, 'done', 4, 0],
    ]);
    const refs = (
      await q('SELECT source_ref FROM import_row WHERE tenant_id = $1', [tenantId])
    ).rows
      .map((row) => row.source_ref as string)
      .sort();
    const expected = converted.files
      .flatMap((file) => (JSON.parse(file.json) as { tickets: { legacyId: string }[] }).tickets)
      .map((ticket) => ticket.legacyId)
      .sort();
    expect(refs).toEqual(expected);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND raised_channel = 'backfill'",
      ),
    ).toBe(22);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM ticket_event WHERE tenant_id = $1 AND type = 'utility_loss'",
      ),
    ).toBe(
      // 2022-08-10 holds 4 machines' lines, 08-11 holds 2, 10-05 holds 1.
      7,
    );

    const again = await loadLegacyYears(db.app, await tenantInfo(), converted.files);
    expect(again.map((l) => [l.imported, l.skipped, l.added.length])).toEqual([
      [0, 18, 0],
      [0, 4, 0],
    ]);
    expect(await count('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1')).toBe(
      await count(
        "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND raised_channel = 'backfill'",
      ),
    );
  });

  it('added the Plant and Utility failure entries and the legend codes as switched-off entries, once, with an audit line each', async () => {
    const first = loaded[0]?.added ?? [];
    expect(first).toEqual(expect.arrayContaining(['location:Plant', 'work_type:Utility failure']));
    const off = (
      await q(
        `SELECT code FROM list_item WHERE tenant_id = $1 AND list = 'maint_code' AND NOT active ORDER BY code`,
        [tenantId],
      )
    ).rows.map((row) => row.code as string);
    const addedCodes = first.filter((e) => e.startsWith('maint_code:')).map((e) => e.slice(11));
    expect(addedCodes).toContain('UTI');
    expect(off).toEqual(expect.arrayContaining(addedCodes));
    expect(
      await count(
        "SELECT count(*)::int AS n FROM audit_log WHERE tenant_id = $1 AND action = 'list_item.legacy_history'",
      ),
    ).toBe(first.length + (loaded[1]?.added.length ?? 0));
  });

  it('keeps every sentinel name out of every stored text', async () => {
    const stored = (
      await q(
        `SELECT concat_ws(' ',
                (SELECT string_agg(to_jsonb(t)::text, ' ') FROM ticket t WHERE tenant_id = $1),
                (SELECT string_agg(to_jsonb(e)::text, ' ') FROM ticket_event e WHERE tenant_id = $1),
                (SELECT string_agg(to_jsonb(b)::text, ' ') FROM breakdown_report b WHERE tenant_id = $1),
                (SELECT string_agg(to_jsonb(i)::text, ' ') FROM import_row i WHERE tenant_id = $1),
                (SELECT string_agg(name, ' ') FROM person WHERE tenant_id = $1)) AS text`,
        [tenantId],
      )
    ).rows[0].text as string;
    for (const name of SENTINELS) expect(stored.toLowerCase()).not.toContain(name.toLowerCase());
  });

  it('lists a fixture day on the desk and drills to the loaded breakdowns', async () => {
    const day = await get('/api/v1/tickets?from=2022-08-10&to=2022-08-11&limit=200');
    expect(day.statusCode, day.body).toBe(200);
    expect((day.json().items as { workType: string | null }[]).map((i) => i.workType)).toContain(
      'Utility failure',
    );
    const result = runYear(await engineData(db.app, tenantId), 2022);
    const drill = result.figures.find((figure) => figure.key === TILE)?.drill;
    expect(drill?.ids).toHaveLength(16);
    const reply = await get(
      `/api/v1/analytics/drill?type=${drill?.type}&ids=${drill?.ids.join(',')}`,
    );
    expect(reply.statusCode, reply.body).toBe(200);
    expect(reply.json().rows).toHaveLength(16);
  });
});

describe('where the runner may write', () => {
  it('refuses a login that is not the app role, and a remote host unless allowed', async () => {
    await expect(connect(db.container.getConnectionUri(), 'cosmos')).rejects.toThrow(/role/i);
    expect(() => assertLocalUrl('postgres://u@db.example.com:5432/x', false)).toThrow(
      /--allow-remote/,
    );
    expect(() => assertLocalUrl('postgres://u@db.example.com:5432/x', true)).not.toThrow();
    for (const local of [
      'postgres://u@localhost/x',
      'postgres://u@127.0.0.1/x',
      'postgres://u@[::1]/x',
      'postgres:///x?host=/var/run/postgresql',
    ]) {
      expect(() => assertLocalUrl(local, false)).not.toThrow();
    }
  });

  it('switches the two plant-event entries back on when they exist switched off, once, and leaves legend codes alone', async () => {
    await q(
      "UPDATE list_item SET active = false WHERE tenant_id = $1 AND code IN ('Plant', 'Utility failure', 'UTI')",
      [tenantId],
    );
    const run = () =>
      withTenant(db.app, tenantId, (c) =>
        ensureLegacyListEntries(c, { tenantId, loginId: null }, ['UTI']),
      );
    expect(await run()).toEqual(['location:Plant', 'work_type:Utility failure']);
    const audits = await q(
      "SELECT before, after FROM audit_log WHERE tenant_id = $1 AND action = 'list_item.legacy_history' AND after->>'switchedOn' = 'true' ORDER BY after->>'code'",
      [tenantId],
    );
    expect(audits.rows.map((r) => r.before)).toEqual([
      { list: 'location', code: 'Plant', active: false },
      { list: 'work_type', code: 'Utility failure', active: false },
    ]);
    expect(await run()).toEqual([]);
    const rows = await q(
      "SELECT code, active FROM list_item WHERE tenant_id = $1 AND code IN ('Plant', 'Utility failure', 'UTI') ORDER BY code",
      [tenantId],
    );
    expect(rows.rows).toEqual([
      { code: 'Plant', active: true },
      { code: 'UTI', active: false },
      { code: 'Utility failure', active: true },
    ]);
  });
});

describe('the summary check matches rows by the workbook that holds them', () => {
  it('leaves the late-2022 row in the 2023 workbook out of the 2022 sheets and keeps it with the 2023 workbook', async () => {
    const data = await engineData(db.app, tenantId);
    const yearOf = await workbookYears(db.app, tenantId);
    const in2022 = loadedFigures(data, { year: 2022, yearOf });
    const in2023 = loadedFigures(data, { year: 2023, yearOf });
    expect(in2022.has('ZZ-1 2022-12')).toBe(false);
    expect(in2022.get('ZZ-1 2022-11')).toEqual({ count: 1, hours: 0.5 });
    expect([...in2023.keys()].sort()).toEqual(['ZZ-1 2022-12', 'ZZ-1 2023-01']);
  });
});

describe('the engine over each year with an explicit period', () => {
  it('counts 16 reports in 2022 and 3 in 2023, none after, and prints the gap months as no records', async () => {
    const data = await engineData(db.app, tenantId);
    const years = [2022, 2023, 2024, 2025].map((year) => runYear(data, year));
    expect(years.map((r) => figureOf(r, TILE))).toEqual([16, 3, 0, 0]);
    // February and March are the held-out gap; April, May and September have no row at all; October holds only a power cut.
    expect(years[0]?.period?.noRecords).toEqual([
      '2022-02',
      '2022-03',
      '2022-04',
      '2022-05',
      '2022-09',
    ]);
  });

  it("counts, per machine and month, the 15 of the 2022 reports the summary sheets' rule calls breakdowns", async () => {
    const mine = loadedFigures(await engineData(db.app, tenantId));
    const of2022 = [...mine].filter(([at]) => at.includes(' 2022-'));
    expect(of2022.reduce((n, [, l]) => n + l.count, 0)).toBe(15);
    expect(mine.get('ZZ-1 2022-07')).toEqual({ count: 3, hours: (2880 + 20 + 20) / 60 });
  });

  it('adds nothing to a breakdown figure with the plant events in, and a month holding only an event reads as recorded', async () => {
    const withEvents = runYear(await engineData(db.app, tenantId), 2022);
    await q(
      "DELETE FROM ticket_event WHERE tenant_id = $1 AND ticket_id IN (SELECT id FROM ticket WHERE tenant_id = $1 AND work_type = 'Utility failure')",
      [tenantId],
    );
    await q(
      "DELETE FROM import_row WHERE tenant_id = $1 AND ticket_id IN (SELECT id FROM ticket WHERE tenant_id = $1 AND work_type = 'Utility failure')",
      [tenantId],
    );
    await q("DELETE FROM ticket WHERE tenant_id = $1 AND work_type = 'Utility failure'", [
      tenantId,
    ]);
    const without = runYear(await engineData(db.app, tenantId), 2022);
    for (const key of [TILE, 'dashboard.total-downtime-hours']) {
      expect(figureOf(without, key)).toEqual(figureOf(withEvents, key));
    }
    // Finding (69c): recordedMonths counts a plant event as a record, so October is observed time with it and a gap without.
    expect(withEvents.period?.noRecords).not.toContain('2022-10');
    expect(without.period?.noRecords).toContain('2022-10');
  });
});
