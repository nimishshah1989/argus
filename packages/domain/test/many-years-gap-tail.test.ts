import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type EngineData, type FigureResult } from '../src/index.js';
import { a9RiskCore, type BottleneckCore } from '../src/analytics/a9-bottleneck.js';
import { fleetRows } from '../src/analytics/a9-forecast-sim.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { baseOf } from '../src/analytics/forecast-lab-sim.js';
import { cellFrac, availableByCell } from '../src/analytics/hours.js';
import { dayNumber } from '../src/analytics/plant-date.js';
import { healthRowsOf } from '../src/analytics/team-focus-health.js';
import { GAP_TAIL, GAP_TAIL_ASOF, GAP_TAIL_SPAN } from './many-years/gap-tail.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND } from './many-years/hand.js';

/**
 * The history-gap tail (ticket 76, packet 76x): three figures that still counted a month with no records as observed
 * time, held against hand values. A run with no span names no gap month and must read exactly as it always did.
 *
 * 1. Forecast Lab exposure, on the two-year fixture. The month after a cut is tested from the cut's day back to the
 *    machine's start. July 2025 (31 days, no records) lies before the August 2025 cut (31 July 2025):
 *    TC-1 is observed 1 January to 31 July = 212 days, 181 once July's 31 are taken out. The February 2026 cut
 *    (31 January 2026) is 365 + 31 = 396 days from 1 January 2025, 365 once July is out; VC-2, bought 1 January
 *    2026, is observed 31 days either way.
 * 2. The 90 and 180-day trend, on the small second fixture (`gap-tail.ts`). Two identical machines, 11 breakdowns of
 *    1 h each (January to December 2026 but October), the last on 10 December. Observed 344 - 31 = 313 days a
 *    machine, so the fitted rate is 22 / (626 / 365) = 11 x 365 / 313 a year. The latest 90 days are 12 September to
 *    10 December: 90 days less October's 31 = 59 observed, holding 2 breakdowns (10 Nov, 10 Dec); the 90 before are
 *    14 June to 11 September, no gap, holding 3 (10 Jul, 10 Aug, 10 Sep). Each window expects rate x days / 365:
 *    11 x 59 / 313 = 649 / 313 and 11 x 90 / 313 = 990 / 313. Trend ratio
 *    (2 + 2) / (649 / 313 + 2) / ((3 + 2) / (990 / 313 + 2)) = 1.014 and the part is 7 - 3.5 x log2(1.014) = 6.93.
 *    Counting October's days as observed (the old arithmetic) expected 990 / 313 in both and read 8.13, "improving".
 * 3. A cell's available hours, on the same fixture: 6,000 annual hours, 11 recorded months = 5,500 each. A-2 is in
 *    cell 1 until 15 June and cell 2 from 16 June: 166 and 199 days of 365; October's 31 are in the second, so the
 *    observed days are 166 and 168 of 334. Cell 2 = 5,500 x 168 / 334, cell 1 = 5,500 (A-1) + 5,500 x 166 / 334.
 */

/** The risk core of one run, as the figure under test would see it. */
const coreOf = (data: EngineData, asOf: string, span?: { from: string; to: string }) => {
  let found: { core: BottleneckCore; data: EngineData } | null = null;
  runWith(
    {
      'team-focus': (input) => {
        found = { core: a9RiskCore(input.data, input.profile)!, data: input.data };
        return { value: null, drillIds: [] };
      },
    },
    { data, asOf, profile: DEFAULT_PROFILE, ...(span ? { span } : {}) },
  );
  return found!;
};

const exposure = (found: { core: BottleneckCore; data: EngineData }, cut: string) =>
  Object.fromEntries(
    baseOf(found.core, fleetRows(found.data), dayNumber(cut)!, dayNumber(found.core.from)!).map(
      (machine) => [machine.machine.id, machine.t],
    ),
  );

describe('the Forecast Lab counts exposure over observed days', () => {
  const span = { from: HAND.both.from, to: HAND.both.to };

  it('takes July 2025 out of every exposure that reaches past it', () => {
    const found = coreOf(MANY_YEARS, AS_OF_ONE_COMPUTER, span);
    expect(exposure(found, '2025-07-31')).toEqual({ 'TC-1': 181, 'VC-1': 181, 'TC-2': 181 });
    expect(exposure(found, '2026-01-31')).toEqual({
      'TC-1': 365,
      'VC-1': 365,
      'TC-2': 365,
      'VC-2': 31,
    });
  });

  it('counts every day when the run names no span', () => {
    const found = coreOf(MANY_YEARS, AS_OF_ONE_COMPUTER);
    expect(exposure(found, '2025-07-31')).toEqual({ 'TC-1': 212, 'VC-1': 212, 'TC-2': 212 });
    expect(exposure(found, '2026-01-31')).toEqual({
      'TC-1': 396,
      'VC-1': 396,
      'TC-2': 396,
      'VC-2': 31,
    });
  });
});

const TREND_RATIO = 4 / (649 / 313 + 2) / (5 / (990 / 313 + 2));
const TREND = 7 - 3.5 * Math.log2(TREND_RATIO);

describe('the health trend scales each window by its observed days', () => {
  it('Team Focus: a gap month in the latest 90 days does not read as improving', () => {
    const { core, data } = coreOf(GAP_TAIL, GAP_TAIL_ASOF, GAP_TAIL_SPAN);
    const rows = healthRowsOf(core, data, DEFAULT_PROFILE.whyWhyThresholdHours);
    expect(TREND).toBeCloseTo(6.93, 2);
    // freq, hours and repair time sit at 7 (the fit is exact for two identical machines), repeat at 10.
    const expected = (0.3 * 7 + 0.25 * 7 + 0.15 * 7 + 0.15 * TREND + 0.1 * 10) / 0.95;
    expect(rows.map((row) => row.score)).toEqual([
      expect.closeTo(expected, 9),
      expect.closeTo(expected, 9),
    ]);
  });

  it('Compare: the scorecard prints 6.9 for the trend, not 8.1', () => {
    const result = runWith(
      { compare: COMPUTERS['compare']! },
      { data: GAP_TAIL, asOf: GAP_TAIL_ASOF, profile: DEFAULT_PROFILE, span: GAP_TAIL_SPAN },
    );
    const figure = result.figures.find((candidate: FigureResult) => candidate.key === 'compare')!;
    const tables = (
      figure.value as unknown as {
        pages: Array<{ tables: Array<{ title: string; rows: string[][] }> }>;
      }
    ).pages[0]!.tables;
    const card = tables.find((table) => table.title.startsWith('Health scorecard'))!;
    const trend = card.rows.find((cells) => cells[0]!.startsWith('Recent trend'))!;
    expect(trend.slice(1)).toEqual([
      expect.stringMatching(/^6\.9.*2 breakdowns in the last 90 days, 3 in the 90 days before/),
      expect.stringMatching(/^6\.9.*2 breakdowns in the last 90 days, 3 in the 90 days before/),
    ]);
  });
});

describe('a cell is credited only the observed days', () => {
  const [a1, a2] = GAP_TAIL.machines as [
    (typeof GAP_TAIL.machines)[0],
    (typeof GAP_TAIL.machines)[0],
  ];
  const window = { ...GAP_TAIL_SPAN, noRecords: ['2026-10'], annualHours: 6000 };

  it('splits a mover over the 334 observed days', () => {
    expect(cellFrac(a2, GAP_TAIL.moves, window, '1')).toBeCloseTo(166 / 334, 12);
    expect(cellFrac(a2, GAP_TAIL.moves, window, '2')).toBeCloseTo(168 / 334, 12);
    expect(cellFrac(a1, GAP_TAIL.moves, window, '1')).toBe(1);
    expect(availableByCell(GAP_TAIL.machines, GAP_TAIL.moves, window, '2')).toBeCloseTo(
      (5500 * 168) / 334,
      9,
    );
    expect(availableByCell(GAP_TAIL.machines, GAP_TAIL.moves, window, '1')).toBeCloseTo(
      5500 + (5500 * 166) / 334,
      9,
    );
  });

  it('counts every day when the window names no gap month', () => {
    const plain = { ...GAP_TAIL_SPAN, annualHours: 6000 };
    expect(cellFrac(a2, GAP_TAIL.moves, plain, '2')).toBeCloseTo(199 / 365, 12);
    expect(availableByCell(GAP_TAIL.machines, GAP_TAIL.moves, plain, '2')).toBeCloseTo(
      (6000 * 199) / 365,
      9,
    );
  });
});
