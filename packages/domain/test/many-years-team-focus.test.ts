import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { a9RiskCore } from '../src/analytics/a9-bottleneck.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { healthRowsOf } from '../src/analytics/team-focus-health.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Team Focus reads the history, gap months left out (ticket 76, packet 76u), held against hand values. The figure
 * learns from every year the plant recorded, so a run names a span and still sees the whole history: the three spans
 * print the same page. The forecast actions (lane A) come from the seeded simulation and are not pinned here.
 *
 * The history is 1 January 2025 to 20 December 2026, July 2025 left out: 365 + 354 - 31 = 688 observed days (packet
 * 76r). The page's "months" is the platform's day difference over 30.44, that difference being the observed days
 * less one (to - from, as it always was): (688 - 1) / 30.44 = 687 / 30.44 months, so a stake of H hours is
 * H x 30.44 / 687 an hour a month. Machine-years are a machine's observed days over 365: 688 / 365, and VC-2's
 * 354 / 365 (bought 1 January 2026).
 *
 * Hours from the fixture's rule: a machine's Axis jam hours are 11 x 1 h in 2025 plus 12 x 2 x 2 h in 2026 = 59 h
 * (VC-2, 2026 only: 48 h); its Panel trip hours 11 x 1 h + 12 x 2 h = 35 h (VC-2: 24 h). The Axis jam group over the
 * plant is 3 x 59 + 48 = 225 h, the Panel trip group 3 x 35 + 24 = 129 h.
 *
 * - Axis group, "one of the biggest losses": 225 x 30.44 / 687 = 6,849 / 687 = 9.97 hrs a month.
 *   Panel group: 129 x 30.44 / 687 = 3,926.76 / 687 = 5.72.
 * - A machine's repeat (Axis): 59 x 30.44 / 687 = 1,795.96 / 687 = 2.61 for TC-1, TC-2 and VC-1; VC-2 48 x 30.44 /
 *   687 = 1,461.12 / 687 = 2.13. A machine's repeat (Panel trip): 35 x 30.44 / 687 = 1,065.4 / 687 = 1.55.
 */

/** The part of the page this test reads. */
interface Action {
  key: string;
  stake: number;
}
const actionsOf = (figure: FigureResult): Action[] =>
  (figure.value as unknown as { extra: Action[] }).extra;

const runFor = (key: SpanKey) => {
  const result = runWith(
    { 'team-focus': COMPUTERS['team-focus']! },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  return result.figures.find((figure: FigureResult) => figure.key === 'team-focus')!;
};

const AXIS = 'Axis motor / drive / encoder / servo';
const PANEL = 'Push button / switch / cable / panel';

describe('Team Focus over the observed days', () => {
  it.each(SPAN_KEYS)('prints each fix-for-good stake over the observed months (span %s)', (key) => {
    const stakes = actionsOf(runFor(key)).filter((item) => item.key.startsWith('fix'));
    expect(stakes.map((item) => [item.key, item.stake])).toEqual([
      [`fixm|TC-1|${AXIS}`, 2.61],
      [`fixm|TC-2|${AXIS}`, 2.61],
      [`fixm|VC-1|${AXIS}`, 2.61],
      [`fixm|VC-2|${AXIS}`, 2.13],
      [`fixm|TC-1|${PANEL}`, 1.55],
      [`fixm|TC-2|${PANEL}`, 1.55],
      [`fixg|${AXIS}`, 9.97],
      [`fixg|${PANEL}`, 5.72],
    ]);
  });

  it('counts each machine health row over its own observed machine-years', () => {
    let rows: Array<[string, number, number]> = [];
    runWith(
      {
        'team-focus': (input) => {
          const core = a9RiskCore(input.data, input.profile)!;
          rows = healthRowsOf(core, input.data, input.profile.whyWhyThresholdHours).map((row) => [
            row.risk.machine.id,
            row.days,
            row.yrs,
          ]);
          return COMPUTERS['team-focus']!(input);
        },
      },
      {
        data: MANY_YEARS,
        asOf: AS_OF_ONE_COMPUTER,
        profile: DEFAULT_PROFILE,
        span: { from: HAND.both.from, to: HAND.both.to },
      },
    );
    expect(rows).toEqual([
      ['TC-1', 688, 688 / 365],
      ['VC-1', 688, 688 / 365],
      ['TC-2', 688, 688 / 365],
      ['VC-2', 354, 354 / 365],
    ]);
  });
});
