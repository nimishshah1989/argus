import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { workingHoursFor } from '../src/analytics/working-hours.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * The shift-calendar figures run per span (ticket 76, packet 76m), held whole against hand values. Basis: the standard
 * column is 21 h x 300 days = 6,300 a machine a year (525 a month), the platform column 20 h x 300 = 6,000 (500 a month),
 * each over the recorded months only. Rows (`NO DT` counts as a failure at 0 h; PM is 3 h): failures 69 / 148 / 217,
 * breakdown hours 66 / 288 / 354, PM hours 36 / 48 / 84. Shift 1 owns `AX`, `NO DT` and every `PM`; shift 2 owns `EL`.
 * The day is 629 minutes of shift 1 and 631 of shift 2, so each shift holds 629/1,260 and 631/1,260 of the hours.
 */

/**
 * Every number is rounded to six decimals on both sides before the whole-value `toEqual`. `periodFraction` adds one
 * twelfth per month, so 11 months sum to 0.9166666666666667 and 17,325 comes out as 17325.000000000004. The
 * tolerance is 5e-7 hours, far below one day of one month (about 17 hours), so it cannot hide a real error.
 */
const settle = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value), (_key, found) =>
    typeof found === 'number' ? Math.round(found * 1e6) / 1e6 : found,
  ) as T;

interface Counts {
  failures: number;
  bd: number;
  pm: number;
}
const COUNTS: Record<SpanKey, Counts> = {
  '2025': { failures: 69, bd: 66, pm: 36 },
  '2026': { failures: 148, bd: 288, pm: 48 },
  both: { failures: 217, bd: 354, pm: 84 },
};
/** Shift 1 and shift 2: breakdowns, breakdown hours, PM hours. */
const SHIFTS: Record<SpanKey, Array<[string, number, number, number, number]>> = {
  '2025': [
    ['1', 36, 33, 36, 629],
    ['2', 33, 33, 0, 631],
  ], // 33 AX + 3 NO DT; 33 EL
  '2026': [
    ['1', 100, 192, 48, 629],
    ['2', 48, 96, 0, 631],
  ], // 96 AX x 2 h + 4 NO DT; 48 EL x 2 h
  both: [
    ['1', 136, 225, 84, 629],
    ['2', 81, 129, 0, 631],
  ], // 36 + 100, 33 + 192; 33 + 48, 33 + 96
};
const MACHINES: Record<SpanKey, number> = { '2025': 3, '2026': 4, both: 4 };

const totals = (hours: number, { failures, bd, pm }: Counts, machines: number) => ({
  workingHours: hours,
  breakdownHours: bd,
  pmHours: pm,
  failures,
  mttr: bd / failures,
  mtbf: (hours - bd) / failures,
  availability: 1 - (bd + pm) / hours,
  bdPct: bd / hours,
  pmPct: pm / hours,
  machines,
  machinesWithoutFailure: 0,
});

/** The five printed cells of each basis, hand-rounded: MTBF, MTTR, availability, breakdown %, PM %. */
const CELLS: Record<SpanKey, string[][]> = {
  '2025': [
    ['238.2', '250.1'],
    ['0.96', '0.96'],
    ['99.38', '99.41'],
    ['0.40', '0.38'],
    ['0.22', '0.21'],
  ],
  '2026': [
    ['160.2', '168.3'],
    ['1.95', '1.95'],
    ['98.60', '98.67'],
    ['1.20', '1.14'],
    ['0.20', '0.19'],
  ],
  both: [
    ['185.0', '194.3'],
    ['1.63', '1.63'],
    ['98.92', '98.97'],
    ['0.87', '0.83'],
    ['0.21', '0.20'],
  ],
};
const MEASURES = ['MTBF (hours)', 'MTTR (hours)', 'Availability (%)', 'Breakdown %', 'PM %'];
const TO = { '2025': '31 Dec 2025', '2026': '31 Dec 2026', both: '31 Dec 2026' };
const STANDARD_HOURS = { '2025': '17,325.00', '2026': '25,200.00', both: '42,525.00' };

/** The split's printed rows: shift label, breakdowns, BD hours, PM hours, working hours, MTTR, MTBF, availability. */
const SPLIT_ROWS: Record<SpanKey, string[][]> = {
  '2025': [
    ['1 (08:00–18:29)', '36', '33.00', '36.00', '8,648.75', '0.92', '239.3', '99.20'],
    ['2 (18:29–05:00)', '33', '33.00', '0.00', '8,676.25', '1.00', '261.9', '99.62'],
    ['PLANT TOTAL', '69', '66.00', '36.00', '17,325.00', '0.96', '250.1', '99.41'],
  ],
  '2026': [
    ['1 (08:00–18:29)', '100', '192.00', '48.00', '12,580.00', '1.92', '123.9', '98.09'],
    ['2 (18:29–05:00)', '48', '96.00', '0.00', '12,620.00', '2.00', '260.9', '99.24'],
    ['PLANT TOTAL', '148', '288.00', '48.00', '25,200.00', '1.95', '168.3', '98.67'],
  ],
  both: [
    ['1 (08:00–18:29)', '136', '225.00', '84.00', '21,228.75', '1.65', '154.4', '98.54'],
    ['2 (18:29–05:00)', '81', '129.00', '0.00', '21,296.25', '1.59', '261.3', '99.39'],
    ['PLANT TOTAL', '217', '354.00', '84.00', '42,525.00', '1.63', '194.3', '98.97'],
  ],
};

const run = (key: SpanKey): Record<string, FigureResult> => {
  const keys = ['shift-kpis.compare', 'shift-kpis.shift-split'];
  const result = runWith(Object.fromEntries(keys.map((k) => [k, COMPUTERS[k]!])), {
    data: MANY_YEARS,
    asOf: AS_OF_ENGINE,
    profile: DEFAULT_PROFILE,
    span: { from: HAND[key].from, to: HAND[key].to },
  });
  return Object.fromEntries(
    result.figures
      .filter((figure) => keys.includes(figure.key))
      .map((figure) => [figure.key, figure]),
  );
};

describe('the shift-calendar figures per span', () => {
  it.each(SPAN_KEYS)('the comparison equals the hand values on both bases, span %s', (key) => {
    const counts = COUNTS[key];
    const machines = MACHINES[key];
    const figure = run(key)['shift-kpis.compare']!;
    expect(settle(figure.value)).toEqual(
      settle({
        screen: 'shift-kpis',
        asOf: HAND[key].to,
        basis: {
          legacy: totals(HAND[key].availableHours, counts, machines),
          standard: totals(HAND[key].workingHours, counts, machines),
          minutesPerDay: 1260,
          annualHours: 6300,
        },
        pages: [
          {
            page: 'shift-kpis',
            title: 'Shift-calendar KPIs',
            kpis: [
              {
                label: 'Working Hours / Day',
                value: '21.0',
                sub: 'the plant’s active shift windows',
              },
              {
                label: 'Working Hours',
                value: STANDARD_HOURS[key],
                sub: `to ${TO[key]} · 6,300 a machine a year`,
              },
              {
                label: 'Failures',
                value: String(counts.failures),
                sub: 'non-PM breakdowns, history and live',
              },
              {
                label: 'Machines Without a Failure',
                value: '0',
                sub: `${machines} machines in production data`,
              },
            ],
            tables: [
              {
                title: 'The platform basis beside the working-hour basis',
                header: ['Measure', 'Platform basis', 'Working-hour basis'],
                rows: MEASURES.map((measure, index) => [measure, ...CELLS[key][index]!]),
                rowCount: 5,
              },
            ],
            charts: [],
          },
        ],
      }),
    );
    expect(figure.drill.ids).toHaveLength(counts.failures);
  });

  it.each(SPAN_KEYS)('the shift split equals the hand values, span %s', (key) => {
    const figure = run(key)['shift-kpis.shift-split']!;
    const rows = SHIFTS[key].map(([code, breakdowns, hours, pm, minutes]) => {
      const workingHours = HAND[key].workingHours * (minutes / 1260);
      return {
        code,
        breakdowns,
        breakdownHours: hours,
        pmHours: pm,
        workingHours,
        mttr: hours / breakdowns,
        mtbf: (workingHours - hours) / breakdowns,
        availability: 1 - (hours + pm) / workingHours,
      };
    });
    expect(settle(figure.value)).toEqual(
      settle({
        screen: 'shift-kpis',
        asOf: HAND[key].to,
        shifts: rows,
        pages: [
          {
            page: 'shift-kpis',
            title: 'The shift split',
            kpis: [],
            tables: [
              {
                title: 'Breakdowns, hours and MTTR by shift',
                header: [
                  'Shift',
                  'Breakdowns',
                  'BD hours',
                  'PM hours',
                  'Working hours',
                  'MTTR',
                  'MTBF',
                  'Availability',
                ],
                rows: SPLIT_ROWS[key],
                rowCount: 3,
              },
            ],
            charts: [],
          },
        ],
      }),
    );
    expect(figure.drill.ids).toHaveLength(COUNTS[key].failures);
  });

  it('one machine has 12,075 working hours over both years, July 2025 left out, and VC-2 only its 12 months', () => {
    const [tc1, , , vc2] = MANY_YEARS.machines;
    const period = { from: '2025-01-01', to: '2026-12-31', noRecords: ['2025-07'] };
    const hours = (machine: typeof tc1) =>
      settle(workingHoursFor(machine!, MANY_YEARS.shifts!, 300, period));
    // TC-1: 23 recorded months x 525 = 12,075; VC-2, bought 2026-01-01: 12 x 525 = 6,300.
    expect([hours(tc1), hours(vc2)]).toEqual([12_075, 6_300]);
    // The same window without a gap list counts July 2025: 24 x 525 = 12,600.
    expect(
      settle(workingHoursFor(tc1!, MANY_YEARS.shifts!, 300, { from: period.from, to: period.to })),
    ).toBe(12_600);
  });
});
