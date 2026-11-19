import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { a9RiskCore } from '../src/analytics/a9-bottleneck.js';
import { healthRows } from '../src/analytics/money-health.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Money Matters reads the history, gap months left out (ticket 76, packet 76t), held against hand values. The seeded
 * simulation rows (next month, plan for, worst case) and the Team Focus stake are not pinned.
 *
 * The history is 1 January 2025 to 20 December 2026, July 2025 left out: 365 + 354 - 31 = 688 observed days
 * (packet 76r). Every lost hour is worth Rs 1,800 (the default throughput, all of it counted as lost sales).
 *
 * Hours by problem, from the fixture's rule: Axis jam 2025 3 machines x 11 months x 1 h = 33 in 33 breakdowns, 2026
 * 4 x 12 x 2 occasions x 2 h = 192 in 96: 225 h in 129. Panel trip 33 h in 33, then 4 x 12 x 2 h = 96 in 48: 129 h in
 * 81. `NO DT` is 7 rows of 0 h. In all 225 + 129 = 354 h.
 *
 * - Money lost: 354 x 1,800 = 637,200 = Rs 6.37 lakh, in 688 days.
 * - Per year: x 365 / 688 = 0.5305: 354 h -> 187.8 -> 188 hrs a year; 637,200 -> 338,049 = Rs 3.38 lakh.
 * - Average month: 637,200 / (688 / 30.44) = 637,200 / 22.60 = Rs 28,192.
 * - Axis jam: 225 h = 405,000 (Rs 4.05 lakh), per year 214,862 (Rs 2.15 lakh), share 225 / 354 = 63.6%.
 *   Panel trip: 129 h = 232,200 (Rs 2.32 lakh), per year 123,188 (Rs 1.23 lakh), share 36.4%. The groups are the
 *   platform's own words for those problems; the 7 `NO DT` rows are "Other / unclear", 0 h.
 * - "Fix repeat problems for good": every breakdown of a machine repeats (4 or more of one problem, in 3 or more
 *   occasions), so the lever holds all 354 h on 4 machines: Rs 6.37 lakh in the period, 338,049 = Rs 3.38 lakh a year.
 * - A machine's health row counts its own days: 688 for TC-1, TC-2 and VC-1, 354 for VC-2 (bought 1 January 2026).
 */

/** The part of the page this test reads. */
interface Page {
  kpis: Array<{ label: string; value: string; sub: string }>;
  tables: Array<{ rows: string[][] }>;
  charts: Array<{ labels: string[]; datasets: Array<{ label: string; data: number[] }> }>;
}
const pageOf = (figure: FigureResult): Page =>
  (figure.value as unknown as { pages: Page[] }).pages[0]!;

const moneyFor = (key: SpanKey) => {
  const result = runWith(
    { 'money-matters': COMPUTERS['money-matters']! },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  const found = result.figures.find((figure: FigureResult) => figure.key === 'money-matters')!;
  return pageOf(found);
};

const healthDays = () => {
  let days: Array<[string, number]> = [];
  runWith(
    {
      'money-matters': (input) => {
        const core = a9RiskCore(input.data, input.profile)!;
        const health = healthRows(input.data, core, input.profile.whyWhyThresholdHours);
        days = health.map((row) => [row.machineId, row.days]);
        return COMPUTERS['money-matters']!(input);
      },
    },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND.both.from, to: HAND.both.to },
    },
  );
  return days;
};

describe('Money Matters over the observed days', () => {
  it.each(SPAN_KEYS)('prints the days, the per-year and the per-month money (span %s)', (key) => {
    const { kpis } = moneyFor(key);
    expect(
      [2, 3, 8].map((index) => ({
        label: kpis[index]!.label,
        value: kpis[index]!.value,
        sub: kpis[index]!.sub,
      })),
    ).toEqual([
      { label: 'Money lost to breakdowns', value: '₹ 6.37 lakh', sub: '354 hrs in 688 days' },
      { label: 'Same, per year', value: '₹ 3.38 lakh', sub: '188 hrs a year' },
      { label: 'Average month so far', value: '₹ 28,192', sub: 'money lost per month' },
    ]);
  });

  it('prints each problem group with its money per year over the observed days', () => {
    const { tables } = moneyFor('both');
    expect(tables[1]!.rows).toEqual([
      [
        'Axis motor / drive / encoder / servo',
        '129',
        '225.0',
        '₹ 4.05 lakh',
        '₹ 2.15 lakh',
        '63.6%',
      ],
      [
        'Push button / switch / cable / panel',
        '81',
        '129.0',
        '₹ 2.32 lakh',
        '₹ 1.23 lakh',
        '36.4%',
      ],
      ['Other / unclear', '7', '0.0', '₹ 0', '₹ 0', '0.0%'],
    ]);
  });

  it('prints the repeat-problem lever with its money per year over the observed days', () => {
    const [lever] = moneyFor('both').tables[0]!.rows;
    expect(lever!.slice(1)).toEqual(['4', '354', '₹ 6.37 lakh', '₹ 3.38 lakh', 'Open']);
    expect(lever![0]).toMatch(/^Fix repeat problems for good/);
  });

  it('counts each machine health row over its own observed days', () => {
    expect(healthDays()).toEqual([
      ['TC-1', 688],
      ['VC-1', 688],
      ['TC-2', 688],
      ['VC-2', 354],
    ]);
  });
});
