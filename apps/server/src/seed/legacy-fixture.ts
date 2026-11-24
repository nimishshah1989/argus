import { readSheet, type Cell, type LegacyRow } from './legacy-sheets.js';

/** Invented workbook grids for the legacy converter tests: sentinel names, invented machines, real-file traps. */
export const KNOWN = new Set(['ZZ-1', 'ZZ-2', 'ZZ-3', 'ZZ-4', 'S-1', 'S-2']);

/** Excel serial of a calendar day (epoch 1899-12-30). */
export const serial = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25_569;

export interface Line {
  date: Cell;
  shift?: Cell;
  problem?: string;
  observed?: string;
  action?: string;
  doneBy?: string;
  minutes?: Cell;
  code?: string;
  em?: string;
  pm?: Cell;
  uti?: Cell;
}

const HEADER: Cell[] = [
  'SR.\nNO.',
  'DATE',
  'Month',
  'SHIFT',
  'PROBLEM DESCRIPTION',
  'OBSERVED BY',
  'CORRECTIVE ACTION',
  'DONE BY',
  'TOTAL \nDOWN TIME\n(In Min.)',
  'TOTAL DOWN TIME (In Hr.)',
  'MAINT CODE',
  'ELECT/MECH',
  'PM',
  'UTI',
];

/** A machine sheet: three title rows, the header at row 4, the lines, then `pad` empty styled rows. */
export function sheet(lines: readonly Line[], pad = 0): Cell[][] {
  const body = lines.map((l, i): Cell[] => [
    i + 1,
    l.date,
    null,
    l.shift ?? '1',
    l.problem ?? 'Spindle alarm',
    l.observed ?? 'Operator',
    l.action ?? null,
    l.doneBy ?? 'Maint. Team',
    l.minutes ?? null,
    null,
    l.code ?? 'M',
    l.em ?? 'M',
    l.pm ?? null,
    l.uti ?? null,
  ]);
  return [[], ['Title'], [], HEADER, ...body, ...Array.from({ length: pad }, (): Cell[] => [])];
}

const NAMES = 'Zorbo Quixle, Vimpl Narden';
const utility = (day: string, uti: number | null, minutes: number | null, code = 'UTI'): Line => ({
  date: serial(day),
  problem: 'Power cut at the incomer',
  code,
  em: 'E',
  uti,
  minutes,
});

/** 2022 workbook: 26 dated rows. Hand-worked in legacy-export.test.ts. */
export function workbook2022(): Record<string, Cell[][]> {
  const own = (day: string, over: Partial<Line> = {}): Line => ({
    date: serial(day),
    minutes: 20,
    ...over,
  });
  return {
    'ZZ-1': sheet(
      [
        {
          date: '03.11.2022',
          shift: '1',
          minutes: 30,
          doneBy: NAMES,
          observed: 'Zorbo',
          problem: 'Zorbo checked the valve, call 9876543210',
          action: 'Quixle replaced the seal',
        },
        own('2022-06-01', { shift: '2ND', minutes: 45, code: 'E', em: 'E' }),
        own('2022-07-04', { shift: '1ST', minutes: 2880, code: 'MIS', em: '' }),
        own('2022-07-05', { shift: '2D', minutes: null, code: '' }),
        own('2022-07-06', { shift: '1TS' }),
        own('2022-07-07', { shift: '1STG' }),
        own('2022-02-03'),
        own('2022-02-04'),
        own('2020-01-01'),
        utility('2022-08-10', 1.5, null),
        utility('2022-08-11', 1, null),
      ],
      50_000,
    ),
    'ZZ-2': sheet([
      own('2022-08-01'),
      own('2022-08-02'),
      own('2022-08-03'),
      own('2022-08-04'),
      utility('2022-08-10', 0.75, null),
      utility('2022-08-11', 0.25, null),
    ]),
    'ZZ-3': sheet([own('2022-08-05'), own('2022-08-06'), utility('2022-08-10', 2, null)]),
    'ZZ-4': sheet([own('2022-08-07'), own('2022-08-08'), utility('2022-08-10', null, 30)]),
    'Star-01': sheet([own('2022-09-01'), own('2022-09-02'), own('2022-09-03')]),
    'MTTR & MTBF': [['summary'], ['no header here']],
  };
}

/** 2023 workbook: 5 dated rows; one repeats a 2022 row, one is a late-2022 row not in the 2022 file. */
export function workbook2023(): Record<string, Cell[][]> {
  const row = (day: string, over: Partial<Line> = {}): Line => ({
    date: serial(day),
    minutes: 20,
    ...over,
  });
  return {
    'ZZ-01': sheet([
      row('2022-06-01', { shift: '2ND', minutes: 45, code: 'E', em: 'E' }),
      row('2022-12-15'),
      row('2023-01-10'),
      row('2023-01-11'),
      row('2023-01-12'),
    ]),
  };
}

/** Both fixture workbooks read into rows (2022 first), as the CLI would. */
export function fixtureRows(): LegacyRow[] {
  const rows: LegacyRow[] = [];
  for (const [year, book] of [
    [2022, workbook2022()],
    [2023, workbook2023()],
  ] as const) {
    for (const [name, grid] of Object.entries(book)) {
      rows.push(...(readSheet(year, name, grid, KNOWN)?.rows ?? []));
    }
  }
  return rows;
}
