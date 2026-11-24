import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES, classifyLegacy } from './legacy-classify.js';
import { KNOWN, sheet } from './legacy-fixture.js';
import type { LegacyRow } from './legacy-sheets.js';
import { readSheet } from './legacy-sheets.js';
import { TRAY_HEADER, trayCsv, trayOf } from './legacy-tray.js';

/** One invented row; only the fields the classifier reads matter. */
const row = (year: number, date: string | null, excelRow: number, machine = 'ZZ-1'): LegacyRow => ({
  year,
  machine,
  excelRow,
  date,
  shift: '1ST',
  problem: 'Spindle alarm',
  observedBy: 'Operator',
  correctiveAction: '',
  doneBy: 'Maint. Team',
  minutes: 30,
  blankMinutes: false,
  code: 'M',
  elecMech: 'M',
  pmHours: 0,
  utiHours: 0,
  hours: null,
});

const classify = (rows: LegacyRow[]) =>
  classifyLegacy(rows, KNOWN, { ...DEFAULT_SWITCHES, star: {}, gap: [] }).rows;

describe('legacy review tray', () => {
  it('holds a row dated after its workbook year, and still loads a row dated before it', () => {
    const rows = [
      row(2023, '2023-05-02', 5),
      row(2023, '2024-11-03', 6),
      row(2023, '2022-11-20', 7),
      row(2024, '2024-01-10', 5, 'ZZ-2'),
      row(2022, '2022-06-01', 5, 'ZZ-2'),
    ];
    expect(classify(rows).map((c) => c.cls)).toEqual([
      'ticket',
      'stray_year',
      'ticket',
      'ticket',
      'ticket',
    ]);
  });

  it('keeps a later-dated row that the later workbook already holds as a duplicate, not in the tray', () => {
    const rows = [row(2024, '2025-01-04', 9), row(2025, '2025-01-04', 5)];
    const classified = classify(rows);
    expect(classified.map((c) => c.cls)).toEqual(['duplicate', 'ticket']);
    expect(trayOf(classified)).toEqual([]);
  });

  it('lists bad-date and stray-year rows by workbook year, machine and Excel row, and nothing else', () => {
    const rows = [
      row(2023, '2024-11-03', 12, 'ZZ-2'),
      row(2023, null, 8, 'ZZ-2'),
      row(2023, '2023-03-01', 5),
      row(2022, '2020-06-01', 40),
      row(2023, '2024-11-03', 6, 'ZZ-2'),
      row(2024, '2024-02-02', 5),
    ];
    expect(trayOf(classify(rows))).toEqual([
      { year: 2022, machine: 'ZZ-1', excelRow: 40, reason: 'stray_year', shift: '' },
      { year: 2023, machine: 'ZZ-2', excelRow: 6, reason: 'stray_year', shift: '' },
      { year: 2023, machine: 'ZZ-2', excelRow: 8, reason: 'bad_date', shift: '' },
      { year: 2023, machine: 'ZZ-2', excelRow: 12, reason: 'stray_year', shift: '' },
    ]);
  });

  it('writes the header and one line per held row', () => {
    const csv = trayCsv([
      { year: 2023, machine: 'ZZ-2', excelRow: 6, reason: 'stray_year', shift: '' },
      { year: 2024, machine: 'ZZ-1', excelRow: 9, reason: 'bad_date', shift: '' },
    ]);
    expect(csv).toBe(`${TRAY_HEADER}\n2023,ZZ-2,6,stray_year,\n2024,ZZ-1,9,bad_date,\n`);
  });

  it('reads a row with a problem but a blank date as a bad date, and still skips an empty template row', () => {
    const grid = sheet([
      { date: 44_927, minutes: 30 },
      { date: null, minutes: 45 },
      { date: null, problem: '', minutes: null },
    ]);
    const read = readSheet(2023, 'ZZ-1', grid, KNOWN);
    expect(read?.dated).toBe(1);
    expect(read?.rows.map((r) => [r.excelRow, r.date])).toEqual([
      [5, '2023-01-01'],
      [6, null],
    ]);
  });
});
