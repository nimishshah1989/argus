import { describe, expect, it } from 'vitest';
import type { ClassifiedRow, RowClass } from '../../apps/server/src/seed/legacy-classify.js';
import type { Cell } from '../../apps/server/src/seed/legacy-sheets.js';
import { compareGrid, readMonthGrid } from '../legacy-grid.js';

const KNOWN = new Set(['ZX-1', 'ZQ-3', 'ZY-7']);
const HOUR = 1 / 24;
const MINUTE = 0.000694444; // 1/1440, as typed: rounds to 1

const block = (days: number[], machines: Cell[][]): Cell[][] => [
  ['MACHINE BREAK-DOWN (July-23)'],
  ['Machine', ...days],
  ...machines,
  ['Total', 9 * HOUR],
  ['Total Weekly Break-Down', 9 * HOUR],
  ['NOTE:-BREAKDOWN TIME IS IN HH:MM:SS FORMAT'],
];

function row(
  machine: string,
  date: string,
  minutes: number,
  opts: { cls?: RowClass; code?: string; year?: number } = {},
): ClassifiedRow {
  return {
    machine,
    cls: opts.cls ?? 'ticket',
    serial: 0,
    dateYear: Number(date.slice(0, 4)),
    row: {
      year: opts.year ?? Number(date.slice(0, 4)),
      machine,
      excelRow: 2,
      date,
      shift: 'A',
      problem: 'x',
      observedBy: '',
      correctiveAction: '',
      doneBy: '',
      minutes,
      blankMinutes: false,
      code: opts.code ?? 'M',
      elecMech: '',
      pmHours: 0,
      utiHours: 0,
      hours: null,
    },
  };
}

describe('Jul-23 grid cross-check, hidden edges (ticket 625)', () => {
  it('sums a machine split across two weeks and two UNIT sheets, rounding each cell to whole minutes', () => {
    const grids = {
      'UNIT-1': [
        ...block([45108, 45109], [['ZX-1', HOUR, 3 * MINUTE]]),
        ...block([45115], [['ZY-7', HOUR]]),
        ...block([45122], [['ZX-01', 2 * HOUR]]),
      ],
      'UNIT-3': block([45129], [['ZX-1', MINUTE]]),
    };
    expect(Object.fromEntries(readMonthGrid(grids, KNOWN))).toEqual({ 'ZX-1': 184, 'ZY-7': 60 });
  });

  it('never reads a Total, weekly total, note or title row as a machine', () => {
    const keys = [...readMonthGrid({ 'UNIT-1': block([45108], [['ZY-7', HOUR]]) }, KNOWN).keys()];
    expect(keys).toEqual(['ZY-7']);
  });

  it('lists a label that does not fold as unknown, after the known machines, never guessed', () => {
    const grid = readMonthGrid(
      {
        'UNIT-2': block(
          [45108, 45109],
          [
            ['STAR', HOUR, null],
            ['ZY-7', HOUR],
          ],
        ),
      },
      KNOWN,
    );
    expect(grid.get('unknown STAR')).toBe(60);
    expect(grid.has('STAR')).toBe(false);
    expect(compareGrid(grid, [row('ZY-7', '2023-07-02', 60)], '2023-07')).toEqual([
      'ZY-7 equal 60',
      'unknown STAR 60',
    ]);
  });

  it('shows grid 0 for a machine the register has but the grid does not', () => {
    const grid = readMonthGrid({ 'UNIT-1': block([45108], [['ZY-7', HOUR]]) }, KNOWN);
    expect(
      compareGrid(grid, [row('ZQ-3', '2023-07-09', 40), row('ZY-7', '2023-07-02', 60)], '2023-07'),
    ).toEqual(['ZQ-3 grid 0 register 40 gap -40', 'ZY-7 equal 60']);
  });

  it("counts only the month's own-year ticket rows that are not PM", () => {
    const grid = readMonthGrid({ 'UNIT-1': block([45108], [['ZY-7', HOUR]]) }, KNOWN);
    const rows = [
      row('ZY-7', '2023-07-02', 60),
      row('ZY-7', '2023-07-03', 500, { code: 'PM' }),
      row('ZY-7', '2023-07-03', 500, { cls: 'utility' }),
      row('ZY-7', '2023-07-03', 500, { cls: 'duplicate' }),
      row('ZY-7', '2023-06-30', 500),
      row('ZY-7', '2024-07-03', 500),
      row('ZY-7', '2023-07-03', 500, { year: 2024 }),
    ];
    expect(compareGrid(grid, rows, '2023-07')).toEqual(['ZY-7 equal 60']);
  });

  it('ignores sheets that are not UNIT sheets', () => {
    const grids = {
      'Total MB': block([45108], [['ZY-7', HOUR]]),
      Sheet1: [
        ['Machine', 45108],
        ['ZY-7', HOUR],
      ],
    };
    expect(readMonthGrid(grids, KNOWN).size).toBe(0);
  });
});
