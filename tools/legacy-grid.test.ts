import { describe, expect, it } from 'vitest';
import type { ClassifiedRow, RowClass } from '../apps/server/src/seed/legacy-classify.js';
import type { Cell } from '../apps/server/src/seed/legacy-sheets.js';
import { compareGrid, readMonthGrid } from './legacy-grid.js';

// Invented sentinel machines; the real Jul-23.xlsx stays outside git.
const KNOWN = new Set(['ZX-1', 'ZX-02', 'ZY-7']);
const HOUR = 1 / 24;
const HALF_HOUR = 0.0208333333;
const ONE_45 = 0.0729166667; // 01:45:00

const block = (days: number[], machines: Cell[][]): Cell[][] => [
  ['MACHINE BREAK-DOWN (July-23)'],
  ['Machine', ...days],
  ...machines,
  ['Total', HOUR],
  ['Total Weekly Break-Down', HOUR],
  ['NOTE:-BREAKDOWN TIME IS IN HH:MM:SS FORMAT'],
];

const GRIDS: Record<string, Cell[][]> = {
  'UNIT-1': block(
    [45110, 45111, 45112],
    [
      ['ZX-01', HOUR, null, HALF_HOUR],
      ['ZY-7', null, null, null],
    ],
  ),
  'UNIT-2': block([45110], [['ZX-02', ONE_45]]),
  'Total MB': [
    ['Machine', 45110],
    ['ZX-01', 5],
  ],
};

function ticket(
  machine: string,
  date: string,
  minutes: number,
  cls: RowClass = 'ticket',
): ClassifiedRow {
  return {
    machine,
    cls,
    serial: 0,
    dateYear: Number(date.slice(0, 4)),
    row: {
      year: Number(date.slice(0, 4)),
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
      code: 'M',
      elecMech: '',
      pmHours: 0,
      utiHours: 0,
      hours: null,
    },
  };
}

describe('Jul-23 grid cross-check (ticket 625)', () => {
  it('reads minutes per machine from every UNIT sheet, folding labels and ignoring Total MB', () => {
    expect(Object.fromEntries(readMonthGrid(GRIDS, KNOWN))).toEqual({
      'ZX-1': 90,
      'ZY-7': 0,
      'ZX-02': 105,
    });
  });

  it("prints equal, or the grid, register and gap, per machine against the month's breakdown rows", () => {
    const rows = [
      ticket('ZX-1', '2023-07-04', 60),
      ticket('ZX-1', '2023-07-05', 30),
      ticket('ZX-02', '2023-07-04', 100),
    ];
    expect(compareGrid(readMonthGrid(GRIDS, KNOWN), rows, '2023-07')).toEqual([
      'ZX-02 grid 105 register 100 gap 5',
      'ZX-1 equal 90',
      'ZY-7 equal 0',
    ]);
  });
});
