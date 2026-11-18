import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { workbookSheets, type ExportSheet } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { tenantInfo } from '../src/modules/identity/index.js';
import { loadEngineData, readProfile } from '../src/modules/analytics/index.js';
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
    return workbookSheets(exportDataFor({ data, profile, tenant: tenant.name, asOf: AS_OF }));
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

  it('writes the breakdown report and its spare cost', async () => {
    const res = await f.call('GET', `/api/v1/reports/workbook.xlsx?asOf=${AS_OF}`, f.tokens.head!);
    const file = join(dir, 'workbook.xlsx');
    writeFileSync(file, res.rawPayload);
    const sheets = readWorkbook(file);
    const log = sheets['Breakdown Log'] ?? [];
    expect(log.length).toBe(4);
    expect(log[3]).toContain(450.5);
    expect(log[3]).toContain('10 mm pu pipe');
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
