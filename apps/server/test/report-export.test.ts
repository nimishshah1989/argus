import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { workbookSheets, type ExportSheet } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { nameCodes, personNames, tenantInfo } from '../src/modules/identity/index.js';
import { loadEngineData, readProfile } from '../src/modules/analytics/index.js';
import { pmReportsForExport } from '../src/modules/tickets/index.js';
import { exportDataFor } from '../src/modules/reports/export-data.js';
import { readWorkbook } from '../../../tools/answer-key/xlsx.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// 45d: the whole data set downloads as the 45c-2 workbook. The PDF route's data and the route's own load are the
// same rows; the test builds the expected sheets with 45c-2's own `workbookSheets` and reads the response back with
// the answer-key reader. `App Settings` is not written (open question 4).

const AS_OF = '2026-11-11';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface KeySheet {
  name: string;
  header: string[];
  dataRows: number;
}

const KEY = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/answer-key/workbook-export.json', import.meta.url),
    'utf8',
  ),
) as { sheets: KeySheet[] };

const dir = mkdtempSync(join(tmpdir(), 'uptimo-export-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let f: Fixture;
let expected: ExportSheet[];
let planId: string;
let pmTicketId: string;
let doneBy: string;

const flat = (rows: readonly (readonly (string | number | null)[])[]) =>
  rows.map((row) => {
    const cells = [...row].map((value) => (value === '' ? null : value));
    while (cells.length > 0 && cells[cells.length - 1] === null) cells.pop();
    return cells;
  });

async function buildExpected(): Promise<ExportSheet[]> {
  return withTenant(f.db.app, A, async (tx) => {
    const data = await loadEngineData(tx, A);
    const profile = await readProfile(tx, A);
    const tenant = await tenantInfo(tx, A);
    // The route's own PM read (50b): the expected sheets must be built the way the download builds them.
    const pmReports = await pmReportsForExport(tx, A);
    // The download prints real names for the codes (ADR 0059), as the route does.
    return nameCodes(
      workbookSheets(exportDataFor({ data, profile, tenant: tenant.name, asOf: AS_OF, pmReports })),
      await personNames(tx, A),
    );
  });
}

beforeAll(async () => {
  f = await startFixture();
  const ticket = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report
       (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category, maint_code, spare_used, spare_cost)
     VALUES ($1, $2, $3, '2026-11-01', 'DAY', 'Spindle noise', 90, 'M', 'BRG', '10 mm pu pipe', 450.5)`,
    [A, ticket, M_USED],
  );
  // Ticket 50b: a live PM plan and a closed PM job with its stored report, so neither PM sheet is header-only.
  doneBy = (
    await f.admin.query(
      "SELECT id FROM person WHERE tenant_id = $1 AND name = 'plant-a technician'",
      [A],
    )
  ).rows[0].id as string;
  planId = (
    await f.admin.query(
      `INSERT INTO pm_plan (tenant_id, machine_id, title, interval_days, last_done_on)
       VALUES ($1, $2, 'Spindle PM', 182, '2026-05-01') RETURNING id`,
      [A, M_USED],
    )
  ).rows[0].id as string;
  pmTicketId = (
    await f.admin.query(
      `INSERT INTO ticket
         (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel,
          task_expected_on, severity)
       VALUES ($1, 'WR-0001', 'general', 'closed', $2, 'Spindle PM', '2026-10-28T04:00:00Z',
               '2026-10-30T10:00:00Z', 'pm', '2026-10-30', 'S4') RETURNING id`,
      [A, M_USED],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report
       (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, pm_report)
     VALUES ($1, $2, $3, '2026-10-30', 'DAY', 'Spindle PM', 30, $4)`,
    [
      A,
      pmTicketId,
      M_USED,
      JSON.stringify({
        total: 2,
        undone: ['p2'],
        readings: { meter: 1250 },
        comments: 'Chip conveyor cleaned',
        doneBy,
        planId,
      }),
    ],
  );
  expected = await buildExpected();
}, 180_000);

afterAll(async () => {
  await f?.stop();
});

describe('the workbook download', () => {
  it('sends the 45c-2 workbook as an attachment with the tenant and the date in its name', async () => {
    const res = await f.call('GET', `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`, f.tokens.head!);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['content-type']).toContain(XLSX_MIME);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="plant-a-workbook-${AS_OF}.xlsx"`,
    );
    expect(res.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('unzips with the 45c-2 sheet names, headers and rows', async () => {
    const res = await f.call('GET', `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`, f.tokens.head!);
    const file = join(dir, 'workbook.xlsx');
    writeFileSync(file, res.rawPayload);
    const sheets = readWorkbook(file);

    const names = expected.map((sheet) => sheet.name);
    expect(Object.keys(sheets)).toEqual(names);
    expect(names).toEqual(
      KEY.sheets.map((sheet) => sheet.name).filter((name) => name !== 'App Settings'),
    );
    for (const sheet of expected) {
      expect(sheets[sheet.name], sheet.name).toEqual(flat(sheet.rows));
      expect(sheets[sheet.name]?.length, sheet.name).toBe(sheet.rows.length);
    }
    for (const keySheet of KEY.sheets.filter((sheet) => sheet.name !== 'App Settings')) {
      expect(sheets[keySheet.name], keySheet.name).toContainEqual(keySheet.header);
    }
  });

  it('prints the live PM Plan and PM Reports rows: one next due per plan, one row per closed PM job', async () => {
    const res = await f.call('GET', `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`, f.tokens.head!);
    const file = join(dir, 'workbook.xlsx');
    writeFileSync(file, res.rawPayload);
    const sheets = readWorkbook(file);
    const header = (name: string) => KEY.sheets.find((sheet) => sheet.name === name)!.header;
    // Plan 2026-05-01 + 182 days is the machine's next due; the platform's 427 visits are not this sheet (50 R15).
    expect(sheets['PM Plan']).toEqual([
      ['plant-a'],
      ['PREVENTIVE MAINTENANCE PLAN'],
      header('PM Plan'),
      [1, 'VC-02', '2026-10-30', 'plan', planId, '2026-05-01'],
    ]);
    const report = {
      total: 2,
      undone: ['p2'],
      readings: { meter: 1250 },
      comments: 'Chip conveyor cleaned',
      // G1.2b (#553): the data column prints the person's name (ADR 0059), never a person or plan id.
      doneBy: 'plant-a technician',
    };
    expect(sheets['PM Reports']).toEqual([
      header('PM Reports'),
      [
        1,
        'VC-02',
        '2026-10-30',
        '2026-10-30',
        'plant-a technician',
        2,
        'p2',
        'meter 1250',
        'Chip conveyor cleaned',
        null,
        null,
        null,
        null,
        pmTicketId,
        JSON.stringify(report),
      ],
    ]);
  });

  it('writes the breakdown report and its spare cost', async () => {
    const res = await f.call('GET', `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`, f.tokens.head!);
    const file = join(dir, 'workbook.xlsx');
    writeFileSync(file, res.rawPayload);
    const sheets = readWorkbook(file);
    const log = sheets['Breakdown Log'] ?? [];
    // The header and three reports: the fixture's breakdown, its PM job (50b) and the seed's own closed one.
    expect(log.length).toBe(5);
    const row = log.find((cells) => cells.includes(450.5));
    expect(row).toBeDefined();
    expect(row).toContain('10 mm pu pipe');
  });
});

describe('who may download the workbook', () => {
  it('asks for a sign-in', async () => {
    expect((await f.call('GET', '/api/v1/reports/workbook.xlsx', '')).statusCode).toBe(401);
  });

  it('refuses an operator and a technician', async () => {
    for (const role of ['operator', 'technician']) {
      const res = await f.call(
        'GET',
        `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`,
        f.tokens[role]!,
      );
      expect(res.statusCode, role).toBe(403);
      expect(res.json().error.code).toBe('forbidden');
    }
  });

  it('refuses an asOf that is not a real plant date', async () => {
    const res = await f.call(
      'GET',
      '/api/v1/reports/workbook.xlsx?asOf=2026-13-01',
      f.tokens.head!,
    );
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('asOf');
  });
});
