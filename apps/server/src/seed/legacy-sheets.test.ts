import { describe, expect, it } from 'vitest';
import { KNOWN, serial, sheet, workbook2022 } from './legacy-fixture.js';
import { findColumns, foldMachine, parseDate, readSheet } from './legacy-sheets.js';

describe('legacy sheets', () => {
  it('reads an Excel serial and the three text spellings, and tells blank from bad', () => {
    expect(parseDate(44562)).toBe('2022-01-01');
    expect(parseDate(serial('2024-02-29'))).toBe('2024-02-29');
    expect(parseDate('03.11.2022')).toBe('2022-11-03');
    expect(parseDate('3-11-2022')).toBe('2022-11-03');
    expect(parseDate('03/11/2022')).toBe('2022-11-03');
    expect(parseDate('31.02.2022')).toBe('bad');
    expect(parseDate('next week')).toBe('bad');
    expect(parseDate(5)).toBe('bad');
    expect(parseDate(null)).toBe('blank');
    expect(parseDate('  ')).toBe('blank');
  });

  it('folds the plant spelling variants to the plant code', () => {
    expect(foldMachine('ZZ-01', KNOWN)).toBe('ZZ-1');
    expect(foldMachine('VL-4', new Set(['VTL-4']))).toBe('VTL-4');
    expect(foldMachine('CAM', new Set(['CAM-01']))).toBe('CAM-01');
    expect(foldMachine('TMC-4_CY52', new Set(['TMC-4']))).toBe('TMC-4');
    expect(foldMachine('Star-01', KNOWN)).toBe('STAR-1');
  });

  it('finds the header at row 4 by its words and skips summary sheets', () => {
    const cols = findColumns(sheet([]));
    expect(cols?.header).toBe(3);
    expect(cols?.date).toBe(1);
    expect(cols?.minutes).toBe(8);
    expect(findColumns([['MTTR'], ['x']])).toBeNull();
  });

  it('reads dated rows only, with their Excel row, and ignores 50,000 empty styled rows', () => {
    const grid = workbook2022()['ZZ-1'] ?? [];
    expect(grid.length).toBeGreaterThan(50_000);
    const read = readSheet(2022, 'ZZ-1', grid, KNOWN);
    expect(read?.dated).toBe(11);
    expect(read?.rows[0]).toMatchObject({ date: '2022-11-03', excelRow: 5, minutes: 30 });
    expect(read?.rows[3]).toMatchObject({ code: '', blankMinutes: true, minutes: 0 });
    expect(read?.rows[8]?.date).toBe('2020-01-01');
  });
});
