import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, NO_RECORDS, type SpanKey } from './many-years/hand.js';

/**
 * Ticket 76, packets 76h and 76i: A1 (BD % and the PM split) over the two-year plant, the whole page held to a page
 * worked out by hand. Nothing below came from running the engine; the rule is `many-years/fixture.ts` and the sums
 * are beside each value.
 *
 * Per machine and month (every month the plant recorded): 2025 has `AX` and `EL` of 1 h each, so 2 h of breakdown;
 * 2026 has three of 2 h each, so 6 h. `NO DT` is no lost time. `PM` is 3 h on the 15th of March, June, September and
 * December. A machine's month has 500 available hours (6,000 / 12). So a cell's BD % in a 2025 month is 2 h per
 * machine over 500 = 0.40 %; in a 2026 month 6 / 500 = 1.20 %. PM % in those four months is 3 / 500 = 0.60 %, else 0.
 * Cell 1 is TC-1 and VC-1, cell 2 is TC-2 and VC-2 (bought 2026-01-01, so cell 2 has one machine in 2025).
 */

const NR = NO_RECORDS;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rep = <T>(count: number, value: T): T[] => Array<T>(count).fill(value);
const AXES = { axes: { x: '', y: '' }, tickLabels: { x: [], y: [] } };
const KPI_SUB = 'hours to 31 Dec · annual 6,000 from Settings';
const BY_CELL_HEADER = ['Cell', 'Machines', 'Available Hrs', 'BD Hrs', 'BD %', 'PM Hrs', 'PM %'];

/** The page A1 prints for a span, as the engine gives it: only this computer runs, over the span named. */
function a1Page(key: SpanKey): unknown {
  const { from, to } = HAND[key];
  const result = runWith(
    { 'a1-bd-pm': COMPUTERS['a1-bd-pm']! },
    { data: MANY_YEARS, asOf: AS_OF_ONE_COMPUTER, profile: DEFAULT_PROFILE, span: { from, to } },
  );
  return result.figures.find((figure) => figure.key === 'a1-bd-pm')?.value;
}

/** 2025, eleven months. Cell 1 has two machines (22 + 22 h of breakdown, 12 + 12 h of PM), cell 2 has TC-2 alone. */
const BD_2025 = [...rep(6, '0.40%'), NR, ...rep(5, '0.40%'), ...rep(4, '0.40%'), '0.40%'];
// Q1 (0 + 0 + 0.6) / 3 = 0.20; Q2 the same; Q3 has two months, (0 + 0.6) / 2 = 0.30; Q4 0.20; year 36 / 16,500 = 0.22.
const PM_2025 = [
  ...['0.00%', '0.00%', '0.60%', '0.00%', '0.00%', '0.60%', NR, '0.00%', '0.60%'],
  ...['0.00%', '0.00%', '0.60%', '0.20%', '0.20%', '0.30%', '0.20%', '0.22%'],
];
const PM_HOURS_2025 = ['—', '—', '6.0', '—', '—', '6.0', NR, '—', '6.0', '—', '—', '6.0'];

const PAGE_2025 = {
  screen: 'a1-bd-pm',
  asOf: '2025-12-31',
  pages: [
    {
      page: 'a1',
      title: 'BD % & PM Split',
      // 3 x 11 x 500 = 16,500 available; 66 h BD = 0.40 %; 36 h PM = 0.218 -> 0.22 %; 100 - 0.4 - 0.218 = 99.38.
      kpis: [
        { label: 'Avg Available Hrs / Machine', value: '5,500', sub: KPI_SUB },
        { label: 'Total Machines', value: '3', sub: 'machines counted in production data' },
        { label: 'Total Available Hrs', value: '16,500', sub: 'whole plant' },
        { label: 'Actual Breakdown', value: '66.0 hrs', sub: '0.40% of available' },
        { label: 'PM Downtime', value: '36.0 hrs', sub: '0.22% of available' },
        { label: 'Fleet Availability', value: '99.38%', sub: 'BD + PM excluded' },
      ],
      tables: [
        {
          title: 'By Cell — Detail',
          header: [...BY_CELL_HEADER, 'Total %'],
          // Cell 1: 2 x 5,500 = 11,000, BD 44 / 11,000 = 0.40, PM 24 / 11,000 = 0.218, together 68 / 11,000 = 0.618.
          // Cell 2: 5,500, BD 22 / 5,500 = 0.40, PM 12 / 5,500 = 0.218, together 34 / 5,500 = 0.618.
          rows: [
            ['Cell 1', '2', '11,000', '44.00', '0.40%', '24.00', '0.22%', '0.62%'],
            ['Cell 2', '1', '5,500', '22.00', '0.40%', '12.00', '0.22%', '0.62%'],
          ],
          rowCount: 2,
        },
        {
          title: 'Month-on-Month — BD % and PM % (2025)',
          header: ['Cell', ...MONTHS, 'Q1 Avg', 'Q2 Avg', 'Q3 Avg', 'Q4 Avg', 'Year 2025'],
          rows: [
            ['Cell 1BD % / PM %', ...BD_2025],
            [...PM_2025],
            ['Cell 2BD % / PM %', ...BD_2025],
            [...PM_2025],
            ['PLANT TOTALBD % / PM %', ...BD_2025],
            [...PM_2025],
          ],
          rowCount: 6,
        },
        {
          title: 'Month-on-Month — BD Hours by Cell (2025)',
          header: ['Cell', ...MONTHS, 'Total'],
          // Cell 1 breaks down 4 h in a month, 4 / 66 = 6.1 % of the year; cell 2 2 h, 2 / 66 = 3.0 %.
          rows: [
            ['Cell 1', ...rep(6, '4.06.1%'), NR, ...rep(5, '4.06.1%'), '44.0'],
            ['Cell 2', ...rep(6, '2.03.0%'), NR, ...rep(5, '2.03.0%'), '22.0'],
          ],
          rowCount: 2,
        },
        {
          title: 'Month-on-Month — PM Hours by Cell (2025)',
          header: ['Cell', ...MONTHS, 'Total'],
          rows: [
            ['Cell 1', ...PM_HOURS_2025, '24.0'],
            ['Cell 2', ...PM_HOURS_2025.map((cell) => (cell === '6.0' ? '3.0' : cell)), '12.0'],
          ],
          rowCount: 2,
        },
      ],
      charts: [
        {
          id: 'ch-a1-cell',
          type: 'bar',
          ...AXES,
          labels: ['Cell 1', 'Cell 2'],
          datasets: [
            { label: 'BD %', data: [0.4, 0.4] },
            { label: 'PM %', data: [0.22, 0.22] },
          ],
        },
        {
          id: 'ch-a1-trend',
          type: 'line',
          ...AXES,
          labels: MONTHS,
          // The plant breaks down 6 h a month (3 machines x 2 h) and holds 9 h of PM in four months; July is null.
          datasets: [
            { label: 'BD Hrs', data: [...rep(6, 6), null, ...rep(5, 6)] },
            { label: 'PM Hrs', data: [0, 0, 9, 0, 0, 9, null, 0, 9, 0, 0, 9] },
          ],
        },
      ],
    },
  ],
};

/**
 * Both years: 24 months keyed by year (`Jan 25` .. `Dec 26`), eight quarters, one year column `Year 2025–2026`.
 * Cell 1: 2 x 23 x 500 = 23,000 available, BD 2 x (22 + 72) = 188 h, PM 2 x 24 = 48 h. Cell 2: TC-2 11,500 plus VC-2
 * 6,000 = 17,500 available, BD (22 + 72) + 72 = 166 h, PM 24 + 12 = 36 h. The plant: 40,500, 354 h and 84 h.
 */
const LABELS_BOTH = ['25', '26'].flatMap((year) => MONTHS.map((month) => `${month} ${year}`));
const BD_BOTH = (year: string) => [
  ...[...rep(6, '0.40%'), NR, ...rep(5, '0.40%'), ...rep(12, '1.20%')],
  ...[...rep(4, '0.40%'), ...rep(4, '1.20%'), year],
];
// 2025 as above; 2026 has all twelve months, so Q3 averages three: (0 + 0 + 0.6) / 3 = 0.20.
const PM_BOTH = [
  ...PM_2025.slice(0, 12),
  ...['0.00%', '0.00%', '0.60%', '0.00%', '0.00%', '0.60%', '0.00%', '0.00%', '0.60%'],
  ...['0.00%', '0.00%', '0.60%', '0.20%', '0.20%', '0.30%', '0.20%'],
  ...rep(4, '0.20%'),
  '0.21%',
];
const PM_HOURS_BOTH = (cell2: boolean) => [
  ...PM_HOURS_2025.map((cell) => (cell2 && cell === '6.0' ? '3.0' : cell)),
  ...['—', '—', '6.0', '—', '—', '6.0', '—', '—', '6.0', '—', '—', '6.0'],
];

const PAGE_BOTH = {
  screen: 'a1-bd-pm',
  asOf: '2026-12-31',
  pages: [
    {
      page: 'a1',
      title: 'BD % & PM Split',
      // 354 / 40,500 = 0.874 -> 0.87 %; 84 / 40,500 = 0.207 -> 0.21 %; 100 - 0.874 - 0.207 = 98.92.
      kpis: [
        { label: 'Avg Available Hrs / Machine', value: '10,125', sub: KPI_SUB },
        { label: 'Total Machines', value: '4', sub: 'machines counted in production data' },
        { label: 'Total Available Hrs', value: '40,500', sub: 'whole plant' },
        { label: 'Actual Breakdown', value: '354.0 hrs', sub: '0.87% of available' },
        { label: 'PM Downtime', value: '84.0 hrs', sub: '0.21% of available' },
        { label: 'Fleet Availability', value: '98.92%', sub: 'BD + PM excluded' },
      ],
      tables: [
        {
          title: 'By Cell — Detail',
          header: [...BY_CELL_HEADER, 'Total %'],
          // Cell 1: 188 / 23,000 = 0.817, 48 / 23,000 = 0.209, 236 / 23,000 = 1.026.
          // Cell 2: 166 / 17,500 = 0.949, 36 / 17,500 = 0.206, 202 / 17,500 = 1.154.
          rows: [
            ['Cell 1', '2', '23,000', '188.00', '0.82%', '48.00', '0.21%', '1.03%'],
            ['Cell 2', '2', '17,500', '166.00', '0.95%', '36.00', '0.21%', '1.15%'],
          ],
          rowCount: 2,
        },
        {
          title: 'Month-on-Month — BD % and PM % (2025–2026)',
          header: [
            'Cell',
            ...LABELS_BOTH,
            ...['25', '26'].flatMap((year) => [1, 2, 3, 4].map((q) => `Q${q} ${year} Avg`)),
            'Year 2025–2026',
          ],
          rows: [
            ['Cell 1BD % / PM %', ...BD_BOTH('0.82%')],
            [...PM_BOTH],
            ['Cell 2BD % / PM %', ...BD_BOTH('0.95%')],
            [...PM_BOTH],
            ['PLANT TOTALBD % / PM %', ...BD_BOTH('0.87%')],
            [...PM_BOTH],
          ],
          rowCount: 6,
        },
        {
          title: 'Month-on-Month — BD Hours by Cell (2025–2026)',
          header: ['Cell', ...LABELS_BOTH, 'Total'],
          // Of 354 h: cell 1 breaks down 4 h in a 2025 month (1.1 %) and 12 h in a 2026 month (3.4 %); cell 2 2 h (0.6 %).
          rows: [
            [
              'Cell 1',
              ...rep(6, '4.01.1%'),
              NR,
              ...rep(5, '4.01.1%'),
              ...rep(12, '12.03.4%'),
              '188.0',
            ],
            [
              'Cell 2',
              ...rep(6, '2.00.6%'),
              NR,
              ...rep(5, '2.00.6%'),
              ...rep(12, '12.03.4%'),
              '166.0',
            ],
          ],
          rowCount: 2,
        },
        {
          title: 'Month-on-Month — PM Hours by Cell (2025–2026)',
          header: ['Cell', ...LABELS_BOTH, 'Total'],
          rows: [
            ['Cell 1', ...PM_HOURS_BOTH(false), '48.0'],
            ['Cell 2', ...PM_HOURS_BOTH(true), '36.0'],
          ],
          rowCount: 2,
        },
      ],
      charts: [
        {
          id: 'ch-a1-cell',
          type: 'bar',
          ...AXES,
          labels: ['Cell 1', 'Cell 2'],
          datasets: [
            { label: 'BD %', data: [0.82, 0.95] },
            { label: 'PM %', data: [0.21, 0.21] },
          ],
        },
        {
          id: 'ch-a1-trend',
          type: 'line',
          ...AXES,
          labels: LABELS_BOTH,
          // 2026 plant: 4 machines x 6 h = 24 h of breakdown a month; 4 x 3 = 12 h of PM in the four PM months.
          datasets: [
            { label: 'BD Hrs', data: [...rep(6, 6), null, ...rep(5, 6), ...rep(12, 24)] },
            {
              label: 'PM Hrs',
              data: [0, 0, 9, 0, 0, 9, null, 0, 9, 0, 0, 9, 0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 0, 12],
            },
          ],
        },
      ],
    },
  ],
};

describe('A1 over the two-year plant', () => {
  it('prints the 2025 page whole: July has no records, Q3 averages two months, the year is 0.40%', () => {
    expect(a1Page('2025')).toEqual(PAGE_2025);
  });

  it('prints the two-year page whole: 24 months with their years, eight quarters, Jan 25 at 0.40%', () => {
    expect(a1Page('both')).toEqual(PAGE_BOTH);
  });
});
