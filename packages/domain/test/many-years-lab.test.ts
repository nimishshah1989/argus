import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * The Forecast Lab does not test a month the plant recorded nothing in (ticket 76, packet 76s), held against the hand
 * month list. The seeded simulation columns (each method's median and range, the scores) are not pinned.
 *
 * A tested month runs from the history's fourth month, 1 January 2025 + 3 = April 2025, through the last month that
 * ended by the last breakdown (20 December 2026): November 2026. April 2025 to November 2026 is 9 + 11 = 20 months,
 * and July 2025 holds no record at all, so 19 are tested: Apr, May, Jun, Aug to Dec 2025 and Jan to Nov 2026.
 *
 * A month's actual hours are the breakdown hours of the machines the month's base holds, a machine counting once it
 * was bought before the day the month's cut falls on (the month's day before):
 * - each 2025 month: 3 machines x (AX 1 h + EL 1 h) = 6.0;
 * - January 2026: VC-2 is bought on 1 January 2026, after the 31 December cut, so 3 machines x (2 + 2 + 2 h) = 18.0;
 * - February to November 2026: 4 machines x (2 + 2 + 2 h) = 24.0. NO DT rows are 0 h.
 */

/** The part of the page this test reads. */
interface Page {
  kpis: Array<{ label: string; value: string; sub: string }>;
  tables: Array<{ rows: string[][] }>;
  charts: Array<{ labels: string[]; datasets: Array<{ label: string; data: number[] }> }>;
}
const pageOf = (figure: FigureResult): Page =>
  (figure.value as unknown as { pages: Page[] }).pages[0]!;

const MONTHS = [
  ...['Apr', 'May', 'Jun', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((name) => `${name} 25`),
  ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map(
    (name) => `${name} 26`,
  ),
];
const ACTUAL = [...Array<number>(8).fill(6), 18, ...Array<number>(10).fill(24)];

const labFor = (key: SpanKey) => {
  const result = runWith(
    { 'forecast-lab': COMPUTERS['forecast-lab']! },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  const found = result.figures.find((figure: FigureResult) => figure.key === 'forecast-lab')!;
  return pageOf(found);
};

describe('the Forecast Lab with a month the plant recorded nothing in', () => {
  it.each(SPAN_KEYS)('tests the 19 hand months, July 2025 not among them (span %s)', (key) => {
    const page = labFor(key);
    const detail: string[][] = page.tables[1]!.rows;
    expect(detail.map((row) => [row[0], row[1]])).toEqual(
      MONTHS.map((month, index) => [month, ACTUAL[index]!.toFixed(1)]),
    );
    expect(page.charts[0]!.labels).toEqual(MONTHS);
    expect(page.charts[0]!.datasets[0]).toEqual({ label: 'Actual', data: ACTUAL });
    expect(page.tables[0]!.rows.map((row: string[]) => row[5]!.split(' of ')[1])).toEqual(
      Array(4).fill('19'),
    );
  });
});
