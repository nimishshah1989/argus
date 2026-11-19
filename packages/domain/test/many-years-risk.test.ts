import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { a9RiskCore } from '../src/analytics/a9-bottleneck.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * The risk core reads the history, gap months left out (ticket 76, packet 76r), held against hand values. The page is
 * the A9 figure, run through the engine so `data.gaps` is what a served run hands it.
 *
 * The history runs from 1 January 2025 (the first breakdown's year) to 20 December 2026 (the last breakdown): 365 days
 * in 2025 plus 354 in 2026 (20 December is day 354) = 719. July 2025 has no record at all, 31 days: 719 - 31 = 688
 * observed days for TC-1, TC-2 and VC-1 (bought in 2020). VC-2, bought 1 January 2026, is observed 354 days.
 *
 * A day is 6,000 / 365 available hours (20 h x 300 days a year). A machine's breakdown hours are its rows' hours, the
 * `NO DT` rows counting as a breakdown of 0 h: TC-1, TC-2 and VC-1 22 + 72 = 94 h in 60 breakdowns (23 + 37), VC-2
 * 72 h in 37. Fleet: 3 x 94 + 72 = 354 h over (3 x 688 + 354) = 2,418 machine-days.
 *
 * - Plant availability: 1 - 354 / (2,418 x 6,000 / 365) = 1 - 0.008906 = 99.11%.
 * - TC-1: 1 - 94 / (688 x 6,000 / 365) = 1 - 0.008312 = 99.17%. VC-2: 1 - 72 / (354 x 6,000 / 365) = 98.76%.
 * - "Past months averaged": the fleet's 354 h over the plant's 688 observed days, times the 31 days of the forecast
 *   month (January 2027): 354 / 688 x 31 = 15.95 -> 16 hrs. The seeded simulation rows are not pinned here.
 */

/** The part of the page this test reads. */
interface Page {
  kpis: Array<{ label: string; value: string; sub: string }>;
  tables: Array<{ rows: string[][] }>;
  charts: Array<{ labels: string[]; datasets: Array<{ label: string; data: number[] }> }>;
}
const pageOf = (figure: FigureResult): Page =>
  (figure.value as unknown as { pages: Page[] }).pages[0]!;

const KEY = 'a9-bottleneck-forecast';

const runFor = (key: SpanKey) => {
  let core: ReturnType<typeof a9RiskCore> = null;
  const figure = COMPUTERS[KEY]!;
  const result = runWith(
    {
      [KEY]: (input) => {
        core = a9RiskCore(input.data, input.profile);
        return figure(input);
      },
    },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  const page = pageOf(result.figures.find((f: FigureResult) => f.key === KEY)!);
  return { core: core as ReturnType<typeof a9RiskCore>, page };
};

describe('the risk core reads the history', () => {
  it.each(SPAN_KEYS)('counts observed days with July 2025 left out (span %s)', (key) => {
    const { core } = runFor(key);
    expect(core!.fleet.map((risk) => [risk.machine.code, risk.days])).toEqual([
      ['TC-1', 688],
      ['VC-1', 688],
      ['TC-2', 688],
      ['VC-2', 354],
    ]);
    expect([core!.from, core!.to]).toEqual(['2025-01-01', '2026-12-20']);
  });

  it('prints the plant availability and each machine availability over those days', () => {
    const { page } = runFor('both');
    expect(page.kpis[3]).toEqual({
      label: 'Plant availability',
      value: '99.11%',
      sub: 'machine hours up, 01 Jan 2025 to 20 Dec 2026',
    });
    const rows: string[][] = page.tables[0]!.rows;
    const byMachine = Object.fromEntries(rows.map((row) => [row[1], [row[5], row[6], row[7]]]));
    expect(byMachine).toEqual({
      'TC-1': ['99.17%', '94.0', '60'],
      'TC-2': ['99.17%', '94.0', '60'],
      'VC-1': ['99.17%', '94.0', '60'],
      'VC-2': ['98.76%', '72.0', '37'],
    });
  });

  it('averages the past months over the observed days', () => {
    const { page } = runFor('both');
    expect(page.kpis[9]!.sub).toMatch(/Past months averaged 16 hrs including long ones$/);
  });
});
