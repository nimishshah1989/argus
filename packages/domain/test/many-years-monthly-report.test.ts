import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';

/**
 * The monthly report runs at 15 February 2026 on the two-year plant with a span (ticket 76, packet 76q): the complete
 * month before is January 2026 against December 2025, and the twelve-month chart behind them runs February 2025 to
 * January 2026 across July 2025, a month with no records. The whole page is held to the hand page below, worked out
 * from the fixture's rule (`many-years/fixture.ts`):
 *
 * - January 2026, per machine of 4: `AX` on days 5 and 12 and `EL` on day 20 at 2 h each, and `NO DT` on day 8 (counted,
 *   no hours): 4 breakdowns and 6.0 h a machine, so 16 breakdowns and 24.0 h. Cell 1 is TC-1 and VC-1, cell 2 TC-2 and
 *   VC-2; TC-1 and TC-2 are turning centers, VC-1 and VC-2 vertical ones; VC-2 is bought on 1 January 2026.
 * - December 2025, per machine of 3: `AX` and `EL` at 1 h each (2.0 h a machine), and 3 PM visits that are no breakdown:
 *   6 breakdowns and 6.0 h. Every month of 2025 but July holds the same 6 breakdowns and 6.0 h.
 */

const DATA: EngineData = {
  ...MANY_YEARS,
  settings: { excludedMachineIds: [], problemFixes: {}, cells: ['1', '2'] },
};

const result = runWith(
  { 'monthly-report': COMPUTERS['monthly-report']! },
  {
    data: DATA,
    asOf: '2026-02-15',
    profile: DEFAULT_PROFILE,
    span: { from: '2025-01-01', to: '2026-02-15' },
  },
);
const figure = result.figures.find((candidate) => candidate.key === 'monthly-report')!;

const table = (title: string, header: string[], rows: string[][]) => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});
const chart = (id: string, labels: Array<string | number>, datasets: unknown[]) => ({
  id,
  type: 'undefined',
  axes: { x: '', y: '', y1: '' },
  tickLabels: { x: [], y: [], y1: [] },
  labels,
  datasets,
});
/** A series of the 31 days of January or December, 0 on a day with no record. */
const days = (byDay: Record<number, number>): number[] =>
  Array.from({ length: 31 }, (_, index) => byDay[index + 1] ?? 0);

const TIME_WENT = ['Breakdowns', 'Hours', 'Prev. hrs', 'Change'];
/** A longest-breakdown row: a 2 h `AX` by Person 1, or an `EL` by Person 2. */
const longest = (date: string, machine: string, code: 'AX' | 'EL') => [
  `${date}-01-2026`,
  machine,
  code === 'AX' ? 'Axis jam' : 'Panel trip',
  code,
  code === 'AX' ? 'Person 1' : 'Person 2',
  '2.0',
];
const machineRows = (machine: string) => [
  longest('05', machine, 'AX'),
  longest('12', machine, 'AX'),
  longest('20', machine, 'EL'),
];

const PAGE = {
  page: 'rep_month',
  title: 'Monthly Report',
  kpis: [],
  tables: [
    // Each machine 4 breakdowns, 6.0 h; December's 2.0 h on the three that existed: +4.0, and VC-2's 0.0: +6.0
    table(
      'Where the time went',
      ['Machine', ...TIME_WENT],
      [
        ['TC-1', '4', '6.0', '2.0', '▲ 4.0'],
        ['VC-1', '4', '6.0', '2.0', '▲ 4.0'],
        ['TC-2', '4', '6.0', '2.0', '▲ 4.0'],
        ['VC-2', '4', '6.0', '0.0', '▲ 6.0'],
      ],
    ),
    // Cell 1: 2 machines, 12.0 h against December's 4.0 h; cell 2: 2 machines, 12.0 h against 2.0 h (VC-2 was not there)
    table(
      'Where the time went',
      ['Cell', ...TIME_WENT],
      [
        ['Cell 1', '8', '12.0', '4.0', '▲ 8.0'],
        ['Cell 2', '8', '12.0', '2.0', '▲ 10.0'],
      ],
    ),
    table(
      'Where the time went',
      ['Category', ...TIME_WENT],
      [
        ['Turning Center', '8', '12.0', '4.0', '▲ 8.0'],
        ['Vertical Machining Center', '8', '12.0', '2.0', '▲ 10.0'],
      ],
    ),
    // AX 4 x 2 x 2 h = 16.0 h against 3 x 1 h; EL 4 x 2 h = 8.0 h against 3 x 1 h; NO DT counts 4 and no hours
    table(
      'Where the time went',
      ['Code', ...TIME_WENT],
      [
        ['AX', '8', '16.0', '3.0', '▲ 13.0'],
        ['EL', '4', '8.0', '3.0', '▲ 5.0'],
        ['NO DT', '4', '0.0', '0.0', '—'],
      ],
    ),
    // The ten longest of the twelve 2 h rows, in the order they were read (TC-1, VC-1, TC-2, then VC-2's first)
    table(
      'Longest breakdowns this period',
      ['Date', 'Machine', 'Problem', 'Code', 'Done by', 'Hours'],
      [
        ...machineRows('TC-1'),
        ...machineRows('VC-1'),
        ...machineRows('TC-2'),
        longest('05', 'VC-2', 'AX'),
      ],
    ),
    // Person 1: AX 8 + NO DT 4 = 12 breakdowns, 16.0 h (1.33 each), December 3 and 3.0 h; Person 2: EL 4, 8.0 h
    table(
      'Maintenance team',
      [
        'Name',
        'Breakdowns attended',
        'December',
        'Change',
        'Hours',
        'Prev. hrs',
        'Change',
        'Avg repair (hrs)',
        'Supported',
        'PM visits',
        'Share',
      ],
      [
        ['Person 1', '12', '3', '▲ +9', '16.0', '3.0', '▲ +13.0', '1.33', '0', '0', '75.0%'],
        ['Person 2', '4', '3', '▲ +1', '8.0', '3.0', '▲ +5.0', '2.00', '0', '0', '25.0%'],
      ],
    ),
    // VC-2, bought on 1 January 2026, is the one machine added: 3 at the start, 4 at the end
    table(
      'Machines added',
      [
        'Category',
        'Fleet at start',
        'Added this period',
        'Added December',
        'Change',
        'Fleet at end',
      ],
      [
        ['Turning Center', '2', '0', '0', 'no change', '2'],
        ['Vertical Machining Center', '1', '1', '0', '▲ +1', '2'],
        ['Total CNC machines', '3', '1', '0', '▲ +1', '4'],
      ],
    ),
    table(
      '',
      ['Action', 'Owner', 'Due date'],
      Array.from({ length: 5 }, () => ['', '', '']),
    ),
  ],
  charts: [
    // 4 machines on each of days 5, 8, 12 and 20 of January; 3 on days 5 and 20 of December
    chart(
      'ch-rp-daily',
      Array.from({ length: 31 }, (_, index) => index + 1),
      [
        { label: 'January breakdowns', data: days({ 5: 4, 8: 4, 12: 4, 20: 4 }) },
        { label: 'January hrs', data: days({ 5: 8, 8: 0, 12: 8, 20: 8 }) },
        { label: 'December breakdowns', data: days({ 5: 3, 20: 3 }) },
      ],
    ),
    // February 2025 to January 2026: 6 breakdowns and 6.0 h a month, July 2025 none at all, January 2026 16 and 24.0 h
    chart(
      'ch-rp-12m',
      [
        'Feb 25',
        'Mar 25',
        'Apr 25',
        'May 25',
        'Jun 25',
        'Jul 25',
        'Aug 25',
        'Sep 25',
        'Oct 25',
        'Nov 25',
        'Dec 25',
        'Jan 26',
      ],
      [
        { label: 'Breakdowns', data: [6, 6, 6, 6, 6, null, 6, 6, 6, 6, 6, 16] },
        { label: 'Downtime hrs', data: [6, 6, 6, 6, 6, null, 6, 6, 6, 6, 6, 24] },
      ],
    ),
  ],
};

describe('the monthly report at 15 February 2026 with a span', () => {
  it('equals the hand page whole: January against December, and Jul 25 null in the twelve-month chart', () => {
    expect(figure.status).toBe('ready');
    expect(figure.value).toEqual({ screen: 'monthly-report', asOf: '2026-02-15', pages: [PAGE] });
  });

  it('drills the 16 breakdown tickets of January', () => {
    expect(figure.drill.ids).toHaveLength(16);
  });
});
