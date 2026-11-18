import { describe, expect, it } from 'vitest';
import { workbookSheets, type ExportRow, type ExportSheet } from '../src/index.js';
import { A1, A2, A3, A4, ENGINE_DATA, type FigureKey } from './answer-key/fixture.js';
import { EXPORT_DATA, WORKBOOK_KEY, type WorkbookKeySheet } from './answer-key/workbook-export.js';

/**
 * The 17-sheet workbook (ticket 45, packet 45c-2), whole against the frozen 11 November key: the sheet names and
 * order, each sheet's exact header row and data-row count, the platform's Settings order, the four Analytics sheets
 * as the A1-A4 figures print them, and the Breakdown Log's 1,350 rows. `App Settings` is excluded (open question 4).
 */

const KEY_SHEETS: readonly WorkbookKeySheet[] = WORKBOOK_KEY.sheets.filter(
  (sheet) => sheet.name !== 'App Settings',
);

function sheets(): ExportSheet[] {
  return workbookSheets(EXPORT_DATA);
}

function sheet(name: string): ExportSheet {
  const found = sheets().find((candidate) => candidate.name === name);
  if (!found) throw new Error(`the workbook holds no sheet "${name}"`);
  return found;
}

function keySheet(name: string): WorkbookKeySheet {
  const found = KEY_SHEETS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`the key holds no sheet "${name}"`);
  return found;
}

/** The row the key calls the header: the first row whose cells are exactly its header row. */
function headerIndex(rows: readonly ExportRow[], header: readonly string[]): number {
  return rows.findIndex(
    (row) =>
      row.length === header.length &&
      row.every((cell, index) => String(cell ?? '') === header[index]),
  );
}

function afterHeader(key: WorkbookKeySheet): ExportRow[] {
  const rows = sheet(key.name).rows;
  const at = headerIndex(rows, key.header);
  expect(at, `${key.name} has its header row`).toBeGreaterThanOrEqual(0);
  return rows.slice(at + 1);
}

function table(key: FigureKey, title: string) {
  const found = key.pages[0]!.tables.find((candidate) => candidate.title === title);
  if (!found) throw new Error(`the key holds no table titled "${title}"`);
  return found;
}

/** A figure's printed row without one column (the workbook's layout drops it). */
function drop(rows: readonly (readonly string[])[], index: number): string[][] {
  return rows.map((row) => row.filter((_, column) => column !== index));
}

const REGISTERS: ReadonlyArray<[string, string, number]> = [
  ['CNC Machine Master', 'CNC', 126],
  ['Conventional Machines', 'Conventional', 16],
  ['Process Machines', 'Process', 17],
  ['DG Sets', 'DG', 3],
  ['Utilities', 'Utility', 30],
];

describe('the whole-data-set workbook', () => {
  it("writes the key's 17 sheets in order, and never App Settings", () => {
    expect(sheets().map(({ name }) => name)).toEqual(KEY_SHEETS.map(({ name }) => name));
    expect(sheets()).toHaveLength(17);
    expect(sheets().some(({ name }) => name === 'App Settings')).toBe(false);
  });

  it("gives every sheet the key's header row and data-row count", () => {
    for (const key of KEY_SHEETS) {
      const rows = sheet(key.name).rows;
      const at = headerIndex(rows, key.header);
      expect(at, `${key.name} has its header row`).toBeGreaterThanOrEqual(0);
      expect(rows.length - at - 1, `${key.name} data rows`).toBe(key.dataRows);
    }
  });

  it('derives the five register sheets from the machine lists, numbered 1..n', () => {
    for (const [name, segment, count] of REGISTERS) {
      const key = keySheet(name);
      const rows = afterHeader(key);
      const machines = ENGINE_DATA.machines.filter((machine) => machine.segment === segment);
      expect(rows, name).toHaveLength(count);
      expect(machines, name).toHaveLength(count);
      expect(rows.map((row) => row[0])).toEqual(
        Array.from({ length: count }, (_, index) => index + 1),
      );
      expect(rows.map((row) => row[1])).toEqual(machines.map((machine) => machine.id));
    }
  });

  it('keeps the platform Settings order: the 14 team rows, then Maintenance Codes, 35 rows after the header', () => {
    const after = afterHeader(keySheet('Settings'));
    expect(after).toHaveLength(35);
    const people = new Map(ENGINE_DATA.people.map((person) => [person.code, person]));
    const team = (ENGINE_DATA.settings?.teamCodes ?? []).map((code) => {
      const person = people.get(code);
      if (!person) throw new Error(`the fixture holds no person "${code}"`);
      return [person.displayName, person.team === 'vendor' ? 'Vendor' : 'Team', 'Active', ''];
    });
    expect(team).toHaveLength(14);
    expect(after.slice(0, 14)).toEqual(team);
    expect(after[14]).toEqual([]);
    expect(after[15]).toEqual(['Maintenance Codes', 'Description']);
    const codes = ENGINE_DATA.lists.maint_code ?? [];
    expect(codes).toHaveLength(19);
    expect(after.slice(16)).toEqual(codes.map((code) => [code.code, code.label]));
    expect(after).toHaveLength(14 + 1 + 1 + codes.length);
  });

  it("prints A1's by-cell table, seven columns, in the Analytics 1 sheet", () => {
    const byCell = table(A1, 'By Cell — Detail');
    expect(afterHeader(keySheet('Analytics 1 - BD%'))).toEqual(drop(byCell.rows, 7));
  });

  it("prints A2's category and cell tables, six columns, in the Analytics 2 sheet", () => {
    const after = afterHeader(keySheet('Analytics 2 - Category-Cell'));
    const category = drop(table(A2, 'By Category — Detail').rows, 4);
    const cell = drop(table(A2, 'By Cell — Detail').rows, 4);
    expect(after).toEqual([
      ...category,
      [],
      ['Cell', 'Machines', '# Breakdowns', 'BD Hours', 'Avg/Machine', 'Avg/Breakdown'],
      ...cell,
    ]);
  });

  it("prints A3's category, cell, age-band and machine blocks in the Analytics 3 sheet", () => {
    const after = afterHeader(keySheet('Analytics 3 - MTTR-MTBF'));
    expect(after).toEqual([
      ...table(A3, 'By Category').rows,
      [],
      ['Cell', 'Machines', '# Breakdowns', 'BD Hours', 'MTTR', 'MTBF'],
      ...table(A3, 'By Cell').rows,
      [],
      ['Age Band', 'Machines', '# Breakdowns', 'BD Hours', 'MTTR', 'MTBF'],
      ...table(A3, 'By Machine Age Band').rows,
      [],
      ['Machine ID', 'Category', 'Cell', '# Breakdowns', 'BD Hours', 'MTTR', 'MTBF'],
      ...table(A3, 'By Individual Machine').rows,
    ]);
  });

  it("prints A4's manpower table whole in the Analytics 4 sheet", () => {
    expect(afterHeader(keySheet('Analytics 4 - Manpower'))).toEqual(
      table(A4, 'Manpower Table').rows,
    );
  });

  it("writes the whole Breakdown Log: 1,350 rows and the key's 30 header cells", () => {
    const key = keySheet('Breakdown Log');
    const after = afterHeader(key);
    expect(after).toHaveLength(1350);
    expect(after).toHaveLength(EXPORT_DATA.data.reports.length);
    const rows = sheet('Breakdown Log').rows;
    const header = rows[headerIndex(rows, key.header)]!;
    expect(header).toHaveLength(30);
    expect(header.map(String)).toEqual(key.header);
  });
});
