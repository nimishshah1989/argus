import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReportChart } from '../src/modules/reports/report-chart.js';
import { chartSvg } from '../src/modules/reports/report-chart.js';
import { importBhavin } from '../src/modules/imports/bhavin.js';
import { breakdownLogExport } from '../src/seed/breakdown-log-export.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';
import { pdfShows, pdfText } from './pdf-text.js';

// 45d: the monthly and annual reports print as server-rendered PDFs from the engine's own figure. The 11 November
// data is the answer key's own workbook, loaded through the history path; the PDF's text layer is read back from its
// font tables. A person is printed by their coded name (P-<id8>), the engine never holds a name.

interface Move {
  date: string;
  machineId: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}

interface Fixture {
  breakdowns: unknown[];
  cellChangeLog: Move[];
  settings: { team: Array<{ name: string }> };
}

const fixture = JSON.parse(
  readFileSync(new URL('../../../fixtures/answer-key/input.json', import.meta.url), 'utf8'),
) as Fixture;
const exportInput = breakdownLogExport(fixture as never);
const annual = JSON.parse(
  readFileSync(new URL('../../../fixtures/answer-key/annual-report.json', import.meta.url), 'utf8'),
) as { pages: Array<{ charts: ReportChart[] }> };

const doc = (name: string): string =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));

/** The people the history names that the cosmos seed does not hold (the history-load harness's own list). */
const HISTORY_PEOPLE = [
  'Maint. Team',
  'Person 39',
  'Person 40',
  'Person 41',
  'Person 46',
  'Person 49',
  'Person 50',
  'Person 51',
  'Person 53',
  'Person 55',
  'Person 68',
  'Person 79',
  'Person 88',
  'Person 89',
];

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let tenantId: string;
let token = '';
let operatorToken = '';
let technicianToken = '';

async function loginAs(role: string): Promise<string> {
  const found = await db.admin.query(
    'SELECT username FROM login WHERE tenant_id = $1 AND role = $2 ORDER BY username LIMIT 1',
    [tenantId, role],
  );
  const username = found.rows[0]?.username as string | undefined;
  if (!username) throw new Error(`the fixture has no ${role} login`);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: FIXTURE_PASSWORD },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().token as string;
}

const get = (url: string, bearer: string) =>
  app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
  });

const flat = (text: string): string => text.replace(/\s+/g, '');

async function seedPeople(): Promise<void> {
  const names = [
    ...new Set([...HISTORY_PEOPLE, ...fixture.settings.team.map((member) => member.name)]),
  ];
  await db.admin.query(
    `INSERT INTO person (tenant_id, name, team)
     SELECT $1, name, 'maintenance' FROM unnest($2::text[]) AS t(name)
      WHERE NOT EXISTS (SELECT 1 FROM person p WHERE p.tenant_id = $1 AND p.name = t.name)`,
    [tenantId, names],
  );
}

/** The key's cell-change log, by the machine code the workbook names. */
async function seedMoves(): Promise<void> {
  const rows = (
    await db.admin.query('SELECT code, id FROM machine WHERE tenant_id = $1', [tenantId])
  ).rows;
  const ids = new Map(rows.map((row) => [row.code as string, row.id as string]));
  for (const move of fixture.cellChangeLog) {
    const [day = '', month = '', year = ''] = move.date.split('-');
    await db.admin.query(
      `INSERT INTO machine_move
         (tenant_id, machine_id, from_cell, to_cell, from_location, to_location, effective_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        ids.get(move.machineId),
        move.fromCell,
        move.toCell,
        move.fromLocation,
        move.toLocation,
        `${year}-${month}-${day}`,
      ],
    );
  }
}

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0]
    .id as string;
  await seedPeople();
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  token = await loginAs('admin');
  operatorToken = await loginAs('operator');
  technicianToken = await loginAs('technician');
  const imported = await importBhavin(db.app, tenantId, exportInput, {
    timeZone: 'Asia/Kolkata',
  });
  expect(imported.stats.errored, JSON.stringify(imported.stats.issues.slice(0, 3))).toBe(0);
  expect(imported.stats.reports).toBe((exportInput.tickets as unknown[]).length);
  await seedMoves();
}, 240_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
});

describe('the monthly report PDF', () => {
  it('prints the title, the period and the key cells', async () => {
    const res = await get('/api/v1/reports/monthly.pdf?asOf=2026-11-11', token);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(String(res.headers['content-disposition'])).toMatch(/^inline; filename=".+\.pdf"$/);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    const text = flat(pdfText(res.rawPayload));
    for (const expected of [
      'Monthly Maintenance Report — October 2026',
      'October 2026',
      'VC-16 CVM1160',
      '25.9',
      'Cell 2',
    ]) {
      expect(text, expected).toContain(flat(expected));
    }
    const person = await db.admin.query(
      "SELECT id FROM person WHERE tenant_id = $1 AND name = 'Person 11'",
      [tenantId],
    );
    // People print by name, never by code (ADR 0058).
    const code = `P-${String(person.rows[0]?.id).slice(0, 8)}`;
    expect(text).toContain(flat('Person 11'));
    expect(text).not.toContain(flat(code));
    expect(text).not.toMatch(/P-[0-9a-f]{8}/);
    // `pdfShows` reads the drawn non-ASCII glyphs; the ASCII cells above are read through `pdfText`.
    expect(pdfShows(res.rawPayload, '—')).toBe(true);
  });

  it('prints the blank commentary form', async () => {
    const res = await get('/api/v1/reports/monthly.pdf?asOf=2026-11-11', token);
    const text = flat(pdfText(res.rawPayload)).toLowerCase();
    expect(text).toContain('managementcommentaryandactions');
    expect(text).toContain('action');
    expect(text).toContain('owner');
    expect(text).toContain('duedate');
  });
});

describe('the annual report PDF', () => {
  it('prints the title, the period and the key cells', async () => {
    const res = await get('/api/v1/reports/annual.pdf?asOf=2026-11-11', token);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(String(res.headers['content-disposition'])).toMatch(/^inline; filename=".+\.pdf"$/);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    const text = flat(pdfText(res.rawPayload));
    for (const expected of [
      'Annual Maintenance Report — 2026',
      '2026 to 11 November',
      'TMC-2 SL30MC',
      '307.6',
      'November (to date)',
    ]) {
      expect(text, expected).toContain(flat(expected));
    }
    expect(pdfShows(res.rawPayload, '—')).toBe(true);
  });
});

describe('who may download a report', () => {
  it('asks for a sign-in on both PDFs', async () => {
    for (const url of ['/api/v1/reports/monthly.pdf', '/api/v1/reports/annual.pdf']) {
      expect((await get(url, '')).statusCode, url).toBe(401);
    }
  });

  it('refuses an operator and a technician', async () => {
    for (const url of ['/api/v1/reports/monthly.pdf', '/api/v1/reports/annual.pdf']) {
      for (const bearer of [operatorToken, technicianToken]) {
        const res = await get(`${url}?asOf=2026-11-11`, bearer);
        expect(res.statusCode, url).toBe(403);
        expect(res.json().error.code).toBe('forbidden');
      }
    }
  });

  it('refuses an asOf that is not a real plant date', async () => {
    for (const url of ['/api/v1/reports/monthly.pdf', '/api/v1/reports/annual.pdf']) {
      const res = await get(`${url}?asOf=2026-02-30`, token);
      expect(res.statusCode, url).toBe(422);
      expect(res.json().error.field).toBe('asOf');
    }
  });
});

describe('the report chart SVG', () => {
  it('draws the Pareto as 15 bars, a 15-point cumulative line and the key labels', () => {
    const chart = annual.pages[0]!.charts.find((one) => one.id === 'ch-ry-pareto');
    if (!chart) throw new Error('the annual key has no ch-ry-pareto');
    const svg = chartSvg(chart);
    expect(svg.match(/<rect class="bar /g) ?? []).toHaveLength(15);
    const points = /<polyline class="line" points="([^"]+)"/.exec(svg)?.[1] ?? '';
    expect(points.split(' ').filter(Boolean)).toHaveLength(15);
    expect(svg.match(/<text [^>]*class="xlabel"/g) ?? []).toHaveLength(15);
    for (const label of chart.labels) expect(svg).toContain(`>${String(label)}</text>`);
  });
});
