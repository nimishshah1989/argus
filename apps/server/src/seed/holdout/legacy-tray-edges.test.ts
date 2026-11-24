import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES, classifyLegacy } from '../legacy-classify.js';
import { KNOWN, sheet } from '../legacy-fixture.js';
import type { LegacyRow } from '../legacy-sheets.js';
import { readSheet } from '../legacy-sheets.js';
import { TRAY_HEADER, trayCsv, trayOf } from '../legacy-tray.js';

const SENTINEL = 'ZZ-Alpha pressed the wrong key';

const row = (
  year: number,
  date: string | null,
  excelRow: number,
  extra: Partial<LegacyRow> = {},
): LegacyRow => ({
  year,
  machine: 'ZZ-1',
  excelRow,
  date,
  shift: '3RD',
  problem: SENTINEL,
  observedBy: SENTINEL,
  correctiveAction: SENTINEL,
  doneBy: SENTINEL,
  minutes: 480,
  blankMinutes: false,
  code: 'UTI',
  elecMech: 'E',
  pmHours: 0,
  utiHours: 0,
  hours: null,
  ...extra,
});

const classify = (rows: LegacyRow[]) =>
  classifyLegacy(rows, KNOWN, { ...DEFAULT_SWITCHES, star: {}, gap: [] }).rows;

describe('legacy review tray (hidden)', () => {
  it('never carries cell content: exactly four keys per row, and no sentinel text in the csv', () => {
    const tray = trayOf(
      classify([row(2023, null, 5), row(2023, '2024-11-03', 6), row(2024, '2024-01-01', 5)]),
    );
    expect(tray).toHaveLength(2);
    for (const t of tray)
      expect(Object.keys(t).sort()).toEqual(['excelRow', 'machine', 'reason', 'year']);
    const csv = trayCsv(tray);
    expect(csv).not.toContain('ZZ-Alpha');
    expect(csv).not.toContain('3RD');
    expect(csv).not.toContain('480');
  });

  it('holds a 2026 row in a 2025 workbook (no 2026 workbook) and keeps the year of the workbook', () => {
    const tray = trayOf(classify([row(2025, '2026-01-05', 7), row(2025, '2025-03-01', 5)]));
    expect(tray).toEqual([{ year: 2025, machine: 'ZZ-1', excelRow: 7, reason: 'stray_year' }]);
  });

  it('holds a later-dated row even when that later year has a workbook and the row is not in it', () => {
    const classified = classify([
      row(2022, '2023-01-03', 9),
      row(2023, '2023-01-03', 5, { minutes: 15 }),
    ]);
    expect(classified[0]?.cls).toBe('stray_year');
    expect(trayOf(classified)).toEqual([
      { year: 2022, machine: 'ZZ-1', excelRow: 9, reason: 'stray_year' },
    ]);
  });

  it('leaves utility, duplicate, gap-month and unknown-machine rows out of the tray', () => {
    const rows = [
      row(2023, '2023-02-01', 5),
      row(2023, '2022-12-01', 6, { code: 'M' }),
      row(2022, '2022-12-01', 5, { code: 'M' }),
      row(2022, '2022-02-10', 6, { code: 'M' }),
      row(2022, '2022-05-10', 7, { code: 'M', machine: 'NO-SUCH' }),
    ];
    const classified = classifyLegacy(rows, KNOWN, { ...DEFAULT_SWITCHES, star: {} }).rows;
    expect(classified.map((c) => c.cls)).toEqual([
      'utility',
      'duplicate',
      'ticket',
      'gap_month',
      'unknown_machine',
    ]);
    expect(trayOf(classified)).toEqual([]);
  });

  it('writes the header alone for an empty tray', () => {
    expect(trayCsv([])).toBe(`${TRAY_HEADER}\n`);
  });

  it('sorts machines as text within a year and Excel rows as numbers', () => {
    const tray = trayOf(
      classify([
        row(2024, null, 100, { machine: 'ZZ-2' }),
        row(2024, null, 20, { machine: 'ZZ-2' }),
        row(2024, null, 3, { machine: 'ZZ-10' }),
      ]),
    );
    expect(tray.map((t) => `${t.machine}:${t.excelRow}`)).toEqual([
      'ZZ-10:3',
      'ZZ-2:20',
      'ZZ-2:100',
    ]);
  });

  it('keeps a blank-date row that has only minutes, and skips one that has neither problem nor minutes', () => {
    const read = readSheet(
      2024,
      'ZZ-1',
      sheet([
        { date: null, problem: '', minutes: 0 },
        { date: null, problem: '', minutes: '' },
      ]),
      KNOWN,
    );
    expect(read?.dated).toBe(0);
    expect(read?.rows.map((r) => r.excelRow)).toEqual([5]);
  });
});
