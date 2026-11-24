import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES, classifyLegacy } from './legacy-classify.js';
import { KNOWN } from './legacy-fixture.js';
import type { LegacyRow } from './legacy-sheets.js';
import { TRAY_HEADER, trayCsv, trayOf } from './legacy-tray.js';

/** Ticket 624: Cosmos runs two shifts (ADR 0026). One invented breakdown row; only the shift varies. */
const row = (shift: string, excelRow: number, extra: Partial<LegacyRow> = {}): LegacyRow => ({
  year: 2023,
  machine: 'ZZ-1',
  excelRow,
  date: `2023-05-${String(excelRow).padStart(2, '0')}`,
  shift,
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
  ...extra,
});

const classify = (rows: LegacyRow[]) =>
  classifyLegacy(rows, KNOWN, { ...DEFAULT_SWITCHES, star: {}, gap: [] });

describe('legacy shifts: A and B only', () => {
  it('loads a row whose shift plainly names A or B', () => {
    const plain = ['1', '1ST', '1STG', '1TS', '2', '2ND', '2D'];
    const { rows } = classify(plain.map((s, i) => row(s, i + 1)));
    expect(rows.map((c) => c.cls)).toEqual(plain.map(() => 'ticket'));
  });

  it('holds every other shift: a third shift, a later number, a letter', () => {
    const odd = ['3', '3RD', '3ND', '4', '8TH', '13TH', 'A'];
    const { rows, reports } = classify(odd.map((s, i) => row(s, i + 1)));
    expect(rows.map((c) => c.cls)).toEqual(odd.map(() => 'held_shift'));
    expect(reports[0]).toMatchObject({ read: 7, tickets: 0, heldShift: 7 });
  });

  it('checks the shift only after the date, the gap months and the machine', () => {
    const rows = classifyLegacy(
      [
        row('3RD', 1, { date: '2024-01-02' }),
        row('3RD', 2, { date: '2023-02-02' }),
        row('3RD', 3, { machine: 'NO-SUCH' }),
        row('3RD', 4),
      ],
      KNOWN,
      { ...DEFAULT_SWITCHES, star: {}, gap: ['2023-02'] },
    ).rows;
    expect(rows.map((c) => c.cls)).toEqual([
      'stray_year',
      'gap_month',
      'unknown_machine',
      'held_shift',
    ]);
  });

  it('puts a held row in the review tray with its shift as written', () => {
    const { rows } = classify([row('3RD', 9), row('1ST', 10), row('A', 11)]);
    expect(trayOf(rows)).toEqual([
      { year: 2023, machine: 'ZZ-1', excelRow: 9, reason: 'held_shift', shift: '3RD' },
      { year: 2023, machine: 'ZZ-1', excelRow: 11, reason: 'held_shift', shift: 'A' },
    ]);
  });

  it('writes the shift as a fifth column, empty for the other reasons', () => {
    expect(TRAY_HEADER).toBe('year,machine,excel_row,reason,shift');
    const csv = trayCsv([
      { year: 2023, machine: 'ZZ-1', excelRow: 9, reason: 'held_shift', shift: '3RD' },
      { year: 2023, machine: 'ZZ-2', excelRow: 4, reason: 'bad_date', shift: '' },
    ]);
    expect(csv).toBe(`${TRAY_HEADER}\n2023,ZZ-1,9,held_shift,3RD\n2023,ZZ-2,4,bad_date,\n`);
  });
});
