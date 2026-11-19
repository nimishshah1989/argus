import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { HAND, NO_RECORDS } from './many-years/hand.js';

/**
 * The annual report runs at 31 December 2025 on the two-year plant with a span (ticket 76, packet 76p2): July 2025 has no
 * records, so its rows read `no records`, the quarter that holds it is two months, and every rate divides by 11 months of
 * hours. The whole page is held to the hand page below, worked out from the fixture's rule (`many-years/fixture.ts`):
 *
 * - Three machines exist (VC-2 is bought in 2026), TC-1 and VC-1 in cell 1 and TC-2 in cell 2, all bought 2020-01-01.
 * - A recorded month, per machine: `AX` and `EL` of 1 h each, so 3 machines give 6 breakdowns and 6.0 h; January adds
 *   3 `NO DT` rows (counted, no hours), so 9 breakdowns; March, June, September and December add 3 PM of 3 h = 9.0 h.
 * - Available a month: 3 x 500 = 1,500. BD % = 6 / 1,500 = 0.40%; with PM 9: 100 - 0.40 - 9 / 1,500 = 99.00%.
 * - The year: 11 recorded months, 66 breakdowns + 3 `NO DT` = 69, 66 h, available 16,500, BD % 66 / 16,500 = 0.40%.
 */

const TABLE_TITLE = 'Preventive maintenance and long breakdowns';
const DATA: EngineData = {
  ...MANY_YEARS,
  settings: { excludedMachineIds: [], problemFixes: {}, cells: ['1', '2'] },
};

const result = runWith(
  { 'annual-report': COMPUTERS['annual-report']! },
  {
    data: DATA,
    asOf: '2025-12-31',
    profile: DEFAULT_PROFILE,
    span: { from: HAND['2025'].from, to: HAND['2025'].to },
  },
);
const figure = result.figures.find((candidate) => candidate.key === 'annual-report')!;

const table = (title: string, header: string[], rows: string[][]) => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});
const chart = (id: string, labels: string[], datasets: unknown[]) => ({
  id,
  type: 'undefined',
  axes: { x: '', y: '', y1: '' },
  tickLabels: { x: [], y: [], y1: [] },
  labels,
  datasets,
});

const NONE = Array<string>(7).fill(NO_RECORDS);
/** A recorded month: 6 breakdowns, 6.0 h, 0.40%; `pm` is its PM hours (0.0 or 9.0) and `availability` follows. */
const month = (name: string, change: string, pm: string, availability: string) => [
  name,
  '6',
  '6.0',
  change,
  '1.00',
  '0.40%',
  pm,
  availability,
];
const MONTHS = [
  // January 9: 6 breakdowns + 3 NO DT; MTTR 6 / 9 = 0.67; the first month has nothing to change from
  ['January', '9', '6.0', '—', '0.67', '0.40%', '0.0', '99.60%'],
  month('February', '▼ 0%', '0.0', '99.60%'),
  month('March', '▼ 0%', '9.0', '99.00%'),
  month('April', '▼ 0%', '0.0', '99.60%'),
  month('May', '▼ 0%', '0.0', '99.60%'),
  month('June', '▼ 0%', '9.0', '99.00%'),
  ['July', ...NONE],
  month('August', '—', '0.0', '99.60%'),
  month('September', '▼ 0%', '9.0', '99.00%'),
  month('October', '▼ 0%', '0.0', '99.60%'),
  month('November', '▼ 0%', '0.0', '99.60%'),
  month('December', '▼ 0%', '9.0', '99.00%'),
];

/** A quarter: breakdowns, hours, change, MTTR, BD %, availability. Q3 has 2 recorded months: 3 x 2 x 500 = 3,000 h. */
const QUARTERS = [
  // Q1: 9 + 6 + 6 = 21 breakdowns, 18 h, MTTR 18 / 21 = 0.86; PM 9 h of 4,500: 100 - 0.40 - 0.20 = 99.40
  ['Q1', '21', '18', '—', '0.86', '0.40%', '99.40%'],
  ['Q2', '18', '18', '▼ 0%', '1.00', '0.40%', '99.40%'],
  // Q3: 12 h against Q2's 18 = -33%; BD % 12 / 3,000 = 0.40; PM 9 / 3,000 = 0.30: 100 - 0.40 - 0.30 = 99.30
  ['Q3', '12', '12', '▼ 33%', '1.00', '0.40%', '99.30%'],
  ['Q4', '18', '18', '▲ 50%', '1.00', '0.40%', '99.40%'],
];

const PM_MONTHS = [
  ['Jan', '0', '0.0'],
  ['Feb', '0', '0.0'],
  ['Mar', '3', '9.0'],
  ['Apr', '0', '0.0'],
  ['May', '0', '0.0'],
  ['Jun', '3', '9.0'],
  ['Jul', NO_RECORDS, NO_RECORDS],
  ['Aug', '0', '0.0'],
  ['Sep', '3', '9.0'],
  ['Oct', '0', '0.0'],
  ['Nov', '0', '0.0'],
  ['Dec', '3', '9.0'],
];
const SHORT = PM_MONTHS.map(([name]) => name!);
const DOTS = Array<string>(12).fill('·');
const ZEROS = Array<string>(12).fill('0');

const PAGE = {
  page: 'rep_year',
  title: 'Annual Report',
  kpis: [],
  tables: [
    table(
      'Month by month',
      [
        'Month',
        'Breakdowns',
        'Downtime hrs',
        'vs prior month',
        'MTTR',
        'BD %',
        'PM hrs',
        'Availability',
      ],
      MONTHS,
    ),
    table(
      'Quarter by quarter',
      ['Quarter', 'Breakdowns', 'Downtime hrs', 'vs prior quarter', 'MTTR', 'BD %', 'Availability'],
      QUARTERS,
    ),
    // Each machine: 22 + 1 NO DT = 23 breakdowns, 22 h, a third of 66 h; all 11 recorded months in the month's top 5
    table(
      'Where the downtime comes from',
      [
        '#',
        'Machine',
        'Category',
        'Age',
        'Cell',
        'Breakdowns',
        'Hours',
        'Share',
        'Cumulative',
        'Months in top 5',
      ],
      [
        ['1', 'TC-1', 'Turning Center', '5y', '1', '23', '22.0', '33.3%', '33.3%', '11'],
        ['2', 'VC-1', 'Vertical Machining Center', '5y', '1', '23', '22.0', '33.3%', '66.7%', '11'],
        ['3', 'TC-2', 'Turning Center', '5y', '2', '23', '22.0', '33.3%', '100.0%', '11'],
      ],
    ),
    // Cell 1 holds 2 machines: 44 h over 2 x 5,500 = 11,000 h; Cell 2 holds 1: 22 h over 5,500 h; both 0.40%
    table(
      'By cell',
      ['Cell', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine', 'BD %'],
      [
        ['Cell 1', '2', '46', '44', '22.0', '0.40%'],
        ['Cell 2', '1', '23', '22', '22.0', '0.40%'],
      ],
    ),
    table(
      'By cause',
      ['Code', 'Breakdowns', 'Hours', 'Share'],
      [
        ['AX', '33', '33', '50.0%'],
        ['EL', '33', '33', '50.0%'],
        ['NO DT', '3', '0', '0.0%'],
      ],
    ),
    // MTBF (5,500 x machines - hours) / breakdowns = (11,000 - 44) / 46 = 238.2 and (5,500 - 22) / 23 = 238.2
    table(
      'Machine categories — reliability',
      ['Category', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine', 'MTTR', 'MTBF'],
      [
        ['Turning Center', '2', '46', '44', '22.0', '0.96', '238'],
        ['Vertical Machining Center', '1', '23', '22', '22.0', '0.96', '238'],
      ],
    ),
    table(
      'Machine age',
      ['Age band', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine'],
      [
        ['0-5 yrs', '0', '0', '0', '0.0'],
        ['5-10 yrs', '3', '69', '66', '22.0'],
        ['10-15 yrs', '0', '0', '0', '0.0'],
        ['15-20 yrs', '0', '0', '0', '0.0'],
        ['20+ yrs', '0', '0', '0', '0.0'],
      ],
    ),
    // Person 1: AX 33 + NO DT 3 = 36 breakdowns, 33 h, 33 / 36 = 0.92; Person 2: EL 33, 33 h, and 12 PM visits
    table(
      'Maintenance team',
      ['Name', 'Breakdowns', 'Hours', 'Avg hrs', 'PM visits'],
      [
        ['Person 1 Team', '36', '33', '0.92', '0'],
        ['Person 2 Team', '33', '33', '1.00', '12'],
      ],
    ),
    table(TABLE_TITLE, ['Month', 'PM entries', 'PM hours'], PM_MONTHS),
    table(TABLE_TITLE, ['Date', 'Machine', 'Hours', 'Problem'], []),
    table(
      'Machines added month by month',
      ['Category', 'Start of 2025', ...SHORT, 'Added', 'End'],
      [
        ['Turning Center', '2', ...DOTS, '0', '2'],
        ['Vertical Machining Center', '1', ...DOTS, '0', '1'],
        ['Total', '3', ...ZEROS, '0', '3'],
      ],
    ),
    table(
      '',
      ['Action', 'Owner', 'Due date'],
      Array.from({ length: 5 }, () => ['', '', '']),
    ),
  ],
  charts: [
    chart('ch-ry-month', SHORT, [
      { label: 'Breakdowns', data: [9, 6, 6, 6, 6, 6, null, 6, 6, 6, 6, 6] },
      { label: 'Downtime hrs', data: [6, 6, 6, 6, 6, 6, null, 6, 6, 6, 6, 6] },
    ]),
    chart(
      'ch-ry-pareto',
      ['TC-1', 'VC-1', 'TC-2'],
      [
        { label: 'Downtime hrs', data: [22, 22, 22] },
        { label: 'Cumulative %', data: [33.3, 66.7, 100] },
      ],
    ),
  ],
};

describe('the annual report at 31 December 2025 with a span', () => {
  it('equals the hand page whole: July no records, Q3 over two months, every rate over 11 months of hours', () => {
    expect(figure.status).toBe('ready');
    expect(figure.value).toEqual({ screen: 'annual-report', asOf: '2025-12-31', pages: [PAGE] });
  });

  it('drills the 69 breakdown tickets of the year, July none', () => {
    expect(figure.drill.ids).toHaveLength(HAND['2025'].failures);
  });
});
