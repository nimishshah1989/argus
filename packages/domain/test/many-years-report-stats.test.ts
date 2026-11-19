import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { monthTable, pmTable, type MonthPoint } from '../src/analytics/annual-report-tables.js';
import {
  MONTH_NAMES,
  monthWindow,
  productionMachines,
  reportEntries,
  reportStats,
} from '../src/analytics/report-period.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { HAND, NO_RECORDS } from './many-years/hand.js';

/**
 * The report arithmetic reads a span with its gap (ticket 76, packet 76p1): `reportStats` takes a `Period`, so July 2025
 * (no report, no ticket) adds no available hours, and the annual report's month and PM-hours tables print `no records`
 * for it. Every value is worked out from the fixture's rule (`many-years/hand.ts`), never read from the engine.
 */

const GAP = ['2025-07'];
const ENTRIES = reportEntries(MANY_YEARS);
const MACHINES = productionMachines(MANY_YEARS);
const stats = (from: string, to: string, noRecords?: readonly string[]) =>
  reportStats(ENTRIES, MACHINES, DEFAULT_PROFILE, {
    from,
    to,
    ...(noRecords ? { noRecords } : {}),
  });
const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

describe('reportStats on 2025 with its gap', () => {
  it('counts 16,500 available hours and the hand failures, hours, rates and MTBF', () => {
    const year = stats('2025-01-01', '2025-12-31', GAP);
    const hand = HAND['2025'];
    expect({
      available: round(year.available, 6),
      failures: year.count,
      breakdownHours: year.hours,
      pmHours: year.pmHours,
      bdPct: round(year.bdPct * 100, 2),
      pmPct: round(year.pmPct * 100, 2),
      availabilityPct: round(year.avail * 100, 2),
      mttr: round(year.mttr, 2),
      mtbf: round(year.mtbf, 1),
      fraction: round(year.fraction, 6),
    }).toEqual({
      // 3 machines x 11 recorded months x 500 h = 16,500; the year is 11 twelfths of itself
      available: hand.availableHours,
      failures: hand.failures,
      breakdownHours: hand.breakdownHours,
      pmHours: hand.pmHours,
      bdPct: hand.bdPct,
      pmPct: hand.pmPct,
      availabilityPct: hand.availabilityPct,
      mttr: hand.mttr,
      mtbf: hand.mtbf,
      fraction: round(11 / 12, 6),
    });
  });

  it('leaves a window with no gap list exactly as before: 3 machines x 12 months x 500 = 18,000', () => {
    const year = stats('2025-01-01', '2025-12-31');
    expect({ available: round(year.available, 6), gap: year.gap }).toEqual({
      available: 18_000,
      gap: false,
    });
  });

  it('gives July alone no hours and no rows, and calls it a gap', () => {
    const july = stats('2025-07-01', '2025-07-31', GAP);
    expect({
      available: july.available,
      count: july.count,
      pmCount: july.pmCount,
      gap: july.gap,
    }).toEqual({
      available: 0,
      count: 0,
      pmCount: 0,
      gap: true,
    });
  });

  it('counts a quarter with one gap month over its two recorded months: 3 x 2 x 500 = 3,000 hours', () => {
    const third = stats('2025-07-01', '2025-09-30', GAP);
    expect({ available: round(third.available, 6), gap: third.gap }).toEqual({
      available: 3_000,
      gap: false,
    });
  });
});

/** The four months May to August, built as the report builds them: one `reportStats` per calendar month. */
const POINTS: MonthPoint[] = [5, 6, 7, 8].map((month) => {
  const window = monthWindow(2025, month);
  return {
    index: month,
    partial: false,
    label: MONTH_NAMES[month - 1]!,
    stats: stats(window.start, window.end, GAP),
  };
});

describe('the annual report month tables on 2025 with its gap', () => {
  it('prints the July row as no records in every cell, and no change against it in August', () => {
    // Recorded month: 3 machines x 2 breakdowns of 1 h = 6 breakdowns, 6.0 h; BD % 6 / 1,500 = 0.40%;
    // MTTR 6 / 6 = 1.00; June adds 3 PM visits of 3 h = 9.0 h, so availability 100 - 0.40 - 9 / 1,500 = 99.00%.
    const none = Array<string>(7).fill(NO_RECORDS);
    expect(monthTable(POINTS).rows).toEqual([
      ['May', '6', '6.0', '—', '1.00', '0.40%', '0.0', '99.60%'],
      ['June', '6', '6.0', '▼ 0%', '1.00', '0.40%', '9.0', '99.00%'],
      ['July', ...none],
      ['August', '6', '6.0', '—', '1.00', '0.40%', '0.0', '99.60%'],
    ]);
  });

  it('prints the July PM hours as no records, and the other months by their visits', () => {
    expect(pmTable(POINTS)).toEqual({
      title: 'Preventive maintenance and long breakdowns',
      header: ['Month', 'PM entries', 'PM hours'],
      rows: [
        ['May', '0', '0.0'],
        ['Jun', '3', '9.0'],
        ['Jul', NO_RECORDS, NO_RECORDS],
        ['Aug', '0', '0.0'],
      ],
      rowCount: 4,
    });
  });
});
