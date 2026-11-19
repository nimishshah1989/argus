import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, NO_RECORDS } from './many-years/hand.js';

/**
 * The breakdown map and A4 across both years, held whole against values worked out by hand (ticket 76, packet 76l).
 *
 * The rule (`many-years/fixture.ts`): each machine has `AX` (Person 1) and `EL` (Person 2) breakdowns - 2 a month of
 * 1 h each in 2025, 3 a month of 2 h each in 2026 (`AX` twice, `EL` once) - plus one `NO DT` (a failure at 0 h, Person
 * 1) every January, and a 3 h `PM` (Person 2) in March, June, September and December. TC-1, VC-1 and TC-2 exist in
 * both years, VC-2 (cell 2) in 2026 only. July 2025 holds no record. So over both years:
 *
 * - a 2025 month, per machine: 1 h `AX` + 1 h `EL` = 2 h; a 2026 month: 2 `AX` x 2 h + 1 `EL` x 2 h = 6 h
 * - TC-1, VC-1, TC-2: 11 x 2 + 12 x 6 = 94 h, 23 + 37 = 60 failures; VC-2: 12 x 6 = 72 h, 37 failures
 * - total 3 x 94 + 72 = 354 h, 3 x 60 + 37 = 217 failures; `AX` 33 + 96 = 129 (33 + 192 = 225 h), `EL` 33 + 48 = 81
 *   (33 + 96 = 129 h), `NO DT` 3 + 4 = 7 (0 h); shift 1 holds `AX` and `NO DT`, shift 2 `EL`.
 */

const SPAN = { from: HAND.both.from, to: HAND.both.to };
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const LABELS = ['25', '26'].flatMap((year) => MONTH_NAMES.map((name) => `${name} ${year}`));
const DASH = '—';

/** 24 printed month cells: `before` for each 2025 month but July (a gap), `after` for each 2026 month; 1-based month. */
const months = (before: (month: number) => string, after: (month: number) => string): string[] => [
  ...Array.from({ length: 12 }, (_, index) => (index === 6 ? NO_RECORDS : before(index + 1))),
  ...Array.from({ length: 12 }, (_, index) => after(index + 1)),
];
const flat = (cell: string) => () => cell;
const everyThird =
  (cell: string, other = DASH) =>
  (month: number) =>
    month % 3 === 0 ? cell : other;

const figureOf = (key: string) =>
  runWith(
    { [key]: COMPUTERS[key]! },
    { data: MANY_YEARS, asOf: AS_OF_ONE_COMPUTER, profile: DEFAULT_PROFILE, span: SPAN },
  ).figures.find((entry) => entry.key === key)!;

/** A Pareto row: failures, hours and the running hours over the 354 total, as a percentage. */
const row = (key: string, breakdowns: number, hours: number, running: number) => ({
  key,
  breakdowns,
  hours,
  cumulativePct: (running / 354) * 100,
});
const printedPct = (running: number): string => ((running / 354) * 100).toFixed(2);
const cents = (value: number): number => Math.round(value * 100) / 100;

interface Rank {
  dimension: string;
  noun: string;
  header: string;
  rows: ReturnType<typeof row>[];
  fifty: { count: number; of: number };
  /** The printed month cells of each row, in row order. */
  cells: string[][];
}

const RANKS: Rank[] = [
  {
    dimension: 'machine',
    noun: 'Machines',
    header: 'Machine',
    // TC-1, TC-2 and VC-1 tie on 94 h and 60 failures and sort by key; VC-2 follows with 72 h. Half of 354 is 177: 94, then 188.
    rows: [
      row('TC-1', 60, 94, 94),
      row('TC-2', 60, 94, 188),
      row('VC-1', 60, 94, 282),
      row('VC-2', 37, 72, 354),
    ],
    fifty: { count: 2, of: 4 },
    cells: [
      months(flat('2.00'), flat('6.00')),
      months(flat('2.00'), flat('6.00')),
      months(flat('2.00'), flat('6.00')),
      months(flat(DASH), flat('6.00')), // VC-2 is bought on 2026-01-01: no failure in 2025
    ],
  },
  {
    dimension: 'cell',
    noun: 'Cells',
    header: 'Cell',
    // Cell 1 = TC-1 + VC-1 = 2 x (60, 94) = (120, 188); cell 2 = TC-2 + VC-2 = (97, 166). 188 passes half of 354.
    rows: [row('1', 120, 188, 188), row('2', 97, 166, 354)],
    fifty: { count: 1, of: 2 },
    cells: [months(flat('4.00'), flat('12.00')), months(flat('2.00'), flat('12.00'))],
  },
  {
    dimension: 'code',
    noun: 'Codes',
    header: 'Code',
    // AX 129 failures, 225 h; EL 81, 129 h; NO DT 7, 0 h. 225 passes half of 354.
    rows: [row('AX', 129, 225, 225), row('EL', 81, 129, 354), row('NO DT', 7, 0, 354)],
    fifty: { count: 1, of: 3 },
    cells: [
      months(flat('3.00'), flat('16.00')), // AX: 3 machines x 1 h; 4 machines x 2 x 2 h
      months(flat('3.00'), flat('8.00')), // EL: 3 machines x 1 h; 4 machines x 2 h
      months(flat(DASH), flat(DASH)), // NO DT has no lost time in any month
    ],
  },
  {
    dimension: 'shift',
    noun: 'Shifts',
    header: 'Shift',
    // Shift 1 = AX + NO DT = (136, 225); shift 2 = EL = (81, 129).
    rows: [row('1', 136, 225, 225), row('2', 81, 129, 354)],
    fifty: { count: 1, of: 2 },
    cells: [months(flat('3.00'), flat('16.00')), months(flat('3.00'), flat('8.00'))],
  },
];

const mapValue = () => ({
  screen: 'shift-kpis',
  asOf: HAND.both.to,
  map: RANKS.map((rank) => ({ dimension: rank.dimension, rows: rank.rows, fiftyPct: rank.fifty })),
  pages: [
    {
      page: 'shift-kpis',
      title: 'Breakdown map',
      kpis: RANKS.map((rank) => ({
        label: `${rank.noun} for half the hours`,
        value: `${rank.fifty.count} of ${rank.fifty.of}`,
        sub: 'the worst rows carry half the lost hours',
      })),
      tables: RANKS.map((rank) => ({
        title: `By ${rank.dimension} — BD hours by month`,
        header: [rank.header, ...LABELS, 'Total', 'Cumulative %'],
        rows: rank.rows.map((entry, index) => [
          entry.key,
          ...rank.cells[index]!,
          entry.hours.toFixed(2),
          printedPct(rank.rows.slice(0, index + 1).reduce((sum, r) => sum + r.hours, 0)),
        ]),
        rowCount: rank.rows.length,
        heat: true,
      })),
      charts: RANKS.map((rank) => ({
        id: `ch-sk-${rank.dimension}`,
        type: 'mixed',
        axes: { x: '', y: '', y1: '' },
        tickLabels: { x: [], y: [], y1: [] },
        labels: rank.rows.map((entry) => entry.key),
        datasets: [
          { label: 'BD hours', data: rank.rows.map((entry) => cents(entry.hours)) },
          { label: 'Cumulative %', data: rank.rows.map((entry) => cents(entry.cumulativePct)) },
        ],
      })),
    },
  ],
});

/** Person 1 handles `AX` (and `NO DT` in January), Person 2 `EL` and every `PM`. */
const a4Value = () => {
  const header = ['Name', ...LABELS, 'Total'];
  // Person 1: 2025 month = 3 machines x 1 `AX` (3, 3 h), January adds 3 `NO DT`; 2026 month = 4 x 2 (8, 16 h), January adds 4.
  // Person 2: 2025 month = 3 `EL` (3, 3 h); 2026 month = 4 (4, 8 h). PM: 3 jobs (9 h) in 2025, 4 (12 h) in 2026, every third month.
  const one = months(
    (m) => (m === 1 ? '6' : '3'),
    (m) => (m === 1 ? '12' : '8'),
  );
  const two = months(flat('3'), flat('4'));
  const pmCount = months(everyThird('3'), everyThird('4'));
  const pmHours = months(everyThird('9.0'), everyThird('12.0'));
  const none = months(flat(DASH), flat(DASH));
  return {
    screen: 'a4-manpower',
    asOf: HAND.both.to,
    pages: [
      {
        page: 'a4',
        title: 'Manpower Efficiency',
        // 217 failures; 354 h; two people. PM is never a breakdown.
        kpis: [
          { label: 'Total Breakdowns', value: '217', sub: 'PM excluded' },
          { label: 'Total BD Hours', value: '354.0', sub: 'across all team' },
          { label: 'Team Members Tracked', value: '2', sub: 'incl. vendors' },
        ],
        tables: [
          {
            title: 'Manpower Table',
            header: [
              'Name',
              'Type',
              '# BD (Done By)',
              'BD Hours (Done)',
              'Avg MTTR',
              '# BD (Supported)',
              'Hours (Supported)',
              'Total Involvement',
              '% of Total',
            ],
            // 136 = 36 + 100 and 225 h; 225 / 136 = 1.65; 136 / 217 = 62.67 %. Person 2: 81, 129 h, 1.59, 37.33 %.
            rows: [
              ['Person 1', 'Team', '136', '225.00', '1.65', '0', '0.00', '136', '62.67%'],
              ['Person 2', 'Team', '81', '129.00', '1.59', '0', '0.00', '81', '37.33%'],
            ],
            rowCount: 2,
          },
          {
            title: 'Preventive Maintenance (PM) — Month-on-Month by Team Member',
            header,
            // Person 2 did every PM (4 x 3 + 4 x 4 = 28 jobs, 36 + 48 = 84 h) and prints first.
            rows: [
              ['Person 2', ...pmCount, '28'],
              [...pmHours, '84.0'],
              ['Person 1', ...months(flat(DASH), flat(DASH)), '0'],
              [...none, '0.0'],
              ['PLANT TOTAL', ...pmCount, '28'],
              [...pmHours, '84.0'],
            ],
            rowCount: 6,
          },
          {
            title: 'Specialization',
            // Turning Center (TC-1 + TC-2): Person 1 2 x 37 = 74, Person 2 2 x 23 = 46; Vertical (VC-1 + VC-2): 37 + 25 = 62, 23 + 12 = 35.
            header: ['Name', 'Turning Cen…', 'Vertical Ma…'],
            rows: [
              ['Person 1', '74', '62'],
              ['Person 2', '46', '35'],
            ],
            rowCount: 2,
          },
          {
            title: 'Month-on-Month — # Breakdowns Handled',
            header,
            rows: [
              ['Person 1', ...one, '136'],
              ['Person 2', ...two, '81'],
            ],
            rowCount: 2,
          },
          {
            title: 'Month-on-Month — BD Hours Handled',
            header,
            // Person 1: 3 h a 2025 month, 16 h a 2026 month (33 + 192 = 225); Person 2: 3 h and 8 h (33 + 96 = 129).
            rows: [
              ['Person 1', ...months(flat('3.0'), flat('16.0')), '225.0'],
              ['Person 2', ...months(flat('3.0'), flat('8.0')), '129.0'],
            ],
            rowCount: 2,
          },
        ],
        charts: [
          {
            id: 'ch-a4-count',
            type: 'bar',
            axes: { x: '', y: '' },
            tickLabels: { x: [], y: [] },
            labels: ['Person 1', 'Person 2'],
            datasets: [{ label: '# Breakdowns', data: [136, 81] }],
          },
        ],
      },
    ],
  };
};

describe('the breakdown map and A4 across both years', () => {
  it('prints the whole map with 24 year-keyed months and no records for July 2025', () => {
    expect(figureOf('shift-kpis.breakdown-map').value).toEqual(mapValue());
  });

  it('prints the whole manpower page with 24 year-keyed months and no records for July 2025', () => {
    expect(figureOf('a4-manpower').value).toEqual(a4Value());
  });
});
