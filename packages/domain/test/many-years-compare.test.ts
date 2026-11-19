import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { compareMachines, historyRows, periodOf, statsOf } from '../src/analytics/compare-score.js';
import { gapMonths } from '../src/analytics/availability.js';
import { isPm } from '../src/analytics/rows.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Compare reads the history, gap months left out (ticket 76, packet 76v), held against hand values. Like Team Focus
 * it learns from every year the plant recorded, so each span prints the same page.
 *
 * The history runs from 1 January 2025 to 20 December 2026: 365 + 354 = 719 days, July 2025's 31 days left out =
 * 688 observed days for TC-1, TC-2 and VC-1 (bought in 2020). VC-2, bought 1 January 2026, is observed 354 days.
 * A day is 6,000 / 365 available hours (20 h x 300 days a year); breakdown hours and failures as in packet 76r
 * (`NO DT` is a failure of 0 h): TC-1, TC-2, VC-1 94 h in 60 failures, VC-2 72 h in 37.
 *
 * - TC-1 (and TC-2, VC-1): available 688 x 6,000 / 365 = 11,309.59 h. Availability 1 - 94 / 11,309.59 = 1 - 0.008312
 *   = 99.17%. MTBF (11,309.59 - 94) / 60 = 186.93, printed 187. Per month 60 / 688 x 30.4 = 2.65, printed 2.7 and
 *   94 / 688 x 30.4 = 4.15, printed 4.2.
 * - VC-2: available 354 x 6,000 / 365 = 5,819.18 h. Availability 1 - 72 / 5,819.18 = 1 - 0.012373 = 98.76%.
 *   MTBF (5,819.18 - 72) / 37 = 155.33.
 * - The page compares the two Turning Centers (the first of two categories with two machines each), so its category
 *   average is the same 99.17% / 187: 688 days each, not 719.
 */

const PER_DAY = 6000 / 365;
const GAPS = gapMonths(MANY_YEARS, AS_OF_ONE_COMPUTER);

const pageOf = (key: SpanKey) => {
  const result = runWith(
    { compare: COMPUTERS['compare']! },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  const figure = result.figures.find((candidate: FigureResult) => candidate.key === 'compare')!;
  return (figure.value as unknown as { pages: Array<{ tables: Array<{ rows: string[][] }> }> })
    .pages[0]!;
};

/** One machine's figures over the history, the way the page reads them with the gap list a served run hands it. */
const statsFor = (id: string) => {
  const data = { ...MANY_YEARS, gaps: GAPS };
  const rows = historyRows(data);
  const machine = compareMachines(data).find((candidate) => candidate.id === id)!;
  const own = rows.filter((row) => row.report.machineId === id);
  return statsOf(
    machine,
    own.filter((row) => !isPm(row)),
    own.filter(isPm),
    { period: periodOf(rows, data.gaps)!, perDay: PER_DAY },
  );
};

describe('Compare over the observed days', () => {
  it('counts each machine over its own observed days', () => {
    expect(['TC-1', 'VC-1', 'TC-2', 'VC-2'].map((id) => statsFor(id).days)).toEqual([
      688, 688, 688, 354,
    ]);
  });

  it('works out availability and MTBF from those days', () => {
    const tc = statsFor('TC-1');
    expect(tc.a).toBeCloseTo(1 - 94 / ((688 * 6000) / 365), 12);
    expect(tc.mtbf).toBeCloseTo(((688 * 6000) / 365 - 94) / 60, 9);
    const vc = statsFor('VC-2');
    expect(vc.a).toBeCloseTo(1 - 72 / ((354 * 6000) / 365), 12);
    expect(vc.mtbf).toBeCloseTo(((354 * 6000) / 365 - 72) / 37, 9);
  });

  it.each(SPAN_KEYS)('prints availability, MTBF and the per-month rows (span %s)', (key) => {
    const checkup = pageOf(key).tables[1]!.rows;
    const row = (label: string) => checkup.find((cells) => cells[0]!.startsWith(label))!.slice(1);
    expect({
      availability: row('Availability'),
      perMonth: row('Breakdowns per month'),
      hoursPerMonth: row('BD hours per month'),
      mtbf: row('MTBF'),
    }).toEqual({
      availability: ['99.17%', '99.17%', '99.17%'],
      perMonth: ['2.7', '2.7', '2.7'],
      hoursPerMonth: ['4.2', '4.2', '4.2'],
      mtbf: ['187', '187', '187'],
    });
  });
});
