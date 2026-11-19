/**
 * The hand values of the two-year fixture (ticket 76, packet 76b). Written once here and read-only afterwards:
 * every later packet imports them and keeps its own figure-specific values in its own test file.
 *
 * Nothing below came from running the engine. Each value is arithmetic on the fixture's rule (`fixture.ts`):
 *
 * - Machines: TC-1, TC-2, VC-1 bought 2020-01-01, VC-2 bought 2026-01-01. Available hours a month: 6,000 / 12 = 500.
 * - 2025, every month but July (11 months), each of three machines: 2 breakdowns of 60 min a month = 22 a machine
 *   over the year; `NO DT` once (30 min, no lost time); `PM` 4 times of 180 min.
 * - 2026, every month, each of four machines: 3 breakdowns of 120 min a month = 36 a machine; `NO DT` once; `PM` 4 times.
 *
 * | Value                     | 2025                        | 2026                       | 2025 + 2026                   |
 * | ------------------------- | --------------------------- | -------------------------- | ----------------------------- |
 * | Failures (non-PM)         | 3 x 22 + 3 = 69             | 4 x 36 + 4 = 148           | 69 + 148 = 217                |
 * | Breakdown hours           | 66 x 1 h = 66               | 144 x 2 h = 288            | 66 + 288 = 354                |
 * | PM hours                  | 12 x 3 h = 36               | 16 x 3 h = 48              | 36 + 48 = 84                  |
 * | Available hours           | 3 x 11 x 500 = 16,500       | 4 x 12 x 500 = 24,000      | 16,500 + 24,000 = 40,500      |
 * | BD % (hours / available)  | 66 / 16,500 = 0.40          | 288 / 24,000 = 1.20        | 354 / 40,500 = 0.874 -> 0.87  |
 * | PM %                      | 36 / 16,500 = 0.218 -> 0.22 | 48 / 24,000 = 0.20         | 84 / 40,500 = 0.207 -> 0.21   |
 * | Availability %            | 100 - 0.40 - 0.22 = 99.38   | 100 - 1.20 - 0.20 = 98.60  | 100 - 0.874 - 0.207 = 98.92   |
 * | MTTR (BD hours / failures)| 66 / 69 = 0.957 -> 0.96     | 288 / 148 = 1.946 -> 1.95  | 354 / 217 = 1.631 -> 1.63     |
 * | MTBF (available - BD) / n | (16,500 - 66) / 69 = 238.2  | (24,000 - 288) / 148 = 160.2 | (40,500 - 354) / 217 = 185.0 |
 * | Days, first to last, gaps | 5 Jan..20 Dec = 350; - 31 = 319 | 5 Jan..20 Dec = 350    | 361 + 354 = 715; - 31 = 684   |
 * | Breakdowns a day          | 69 / 319 = 0.216 -> 0.22    | 148 / 350 = 0.423 -> 0.42  | 217 / 684 = 0.317 -> 0.32     |
 * | BD hours a day            | 66 / 319 = 0.207 -> 0.21    | 288 / 350 = 0.823 -> 0.82  | 354 / 684 = 0.518 -> 0.52     |
 * | BD hours per CNC machine  | 66 / 3 = 22                 | 288 / 4 = 72               | 354 / 4 = 88.5                |
 * | Working hours (21 h x 300)| 3 x 11/12 x 6,300 = 17,325  | 4 x 6,300 = 25,200         | 17,325 + 25,200 = 42,525      |
 *
 * Days: 5 January is day 5 of 2025 and 20 December is day 354, so 354 - 5 + 1 = 350. Across both years the first
 * span is 365 - 5 + 1 = 361 days of 2025, then 354 days of 2026: 715. July 2025 holds 31 days with no record.
 *
 * A1's PLANT TOTAL BD % for one month is that month's breakdown hours over that month's available hours:
 * January 2025 = 3 machines x 2 x 1 h = 6 h over 3 x 500 = 1,500 -> 0.40%; January 2026 = 4 x 3 x 2 h = 24 h over
 * 4 x 500 = 2,000 -> 1.20%; July 2026 is the same 24 / 2,000 -> 1.20%; July 2025 has no record at all.
 *
 * TC-1's machine page MTBF is (its available hours - its breakdown hours) / its failures:
 * 2025: 11 x 500 = 5,500 hours, 22 breakdown hours, 22 + 1 `NO DT` = 23 failures -> (5,500 - 22) / 23 = 238.2;
 * 2026: 6,000 hours, 36 x 2 = 72 hours, 36 + 1 = 37 failures -> (6,000 - 72) / 37 = 160.2;
 * both: 23 months x 500 = 11,500 hours, 22 + 72 = 94 hours, 23 + 37 = 60 failures -> (11,500 - 94) / 60 = 190.1.
 * VC-2 exists in 2026 only: no failure in 2025 (`null`), and its 2026 figure is TC-1's 160.2 (same rule, same
 * arithmetic) over 2026 and over both years, because it has only 12 months of existence either way.
 */

/** The three spans every packet reads, named by what they cover. */
export type SpanKey = '2025' | '2026' | 'both';

export interface HandSpan {
  from: string;
  to: string;
  /** The `YYYY-MM` months inside the span that hold no report and no ticket. */
  noRecords: readonly string[];
  /** Months of the span that hold records: 12 or 24 less the gap. */
  recordedMonths: number;
  /** Production machines bought on or before the span's end. */
  machines: number;
  failures: number;
  breakdownHours: number;
  pmHours: number;
  availableHours: number;
  /** Printed percentages, two decimals. */
  bdPct: number;
  pmPct: number;
  availabilityPct: number;
  /** Printed hours, MTTR to two decimals, MTBF to one. */
  mttr: number;
  mtbf: number;
  /** Days from the first to the last breakdown, the days of every no-records month taken out. */
  observedDays: number;
  breakdownsPerDay: number;
  bdHoursPerDay: number;
  bdHoursPerMachine: number;
  /** A1's PLANT TOTAL BD % cell of the named months, as printed. */
  a1PlantBdPct: Readonly<Record<string, string>>;
  /** The machine page's MTBF, hours to one decimal; `null` where the machine has no failure in the span. */
  mtbfTc1: number | null;
  mtbfVc2: number | null;
  /** The standard (shift calendar) basis: 21 h a day x 300 days = 6,300 a year, per machine-month 525. */
  workingHours: number;
}

export const NO_RECORDS = 'no records';

/** `asOf` for a packet that runs one computer, and for a packet that runs the whole engine (see the plan's note). */
export const AS_OF_ONE_COMPUTER = '2026-12-31';
export const AS_OF_ENGINE = '2027-01-31';

export const SPAN_KEYS: readonly SpanKey[] = ['2025', '2026', 'both'];

export const HAND: Readonly<Record<SpanKey, HandSpan>> = {
  '2025': {
    from: '2025-01-01',
    to: '2025-12-31',
    noRecords: ['2025-07'],
    recordedMonths: 11,
    machines: 3,
    failures: 66 + 3,
    breakdownHours: 66,
    pmHours: 36,
    availableHours: 3 * 11 * 500,
    bdPct: 0.4,
    pmPct: 0.22,
    availabilityPct: 99.38,
    mttr: 0.96,
    mtbf: 238.2,
    observedDays: 350 - 31,
    breakdownsPerDay: 0.22,
    bdHoursPerDay: 0.21,
    bdHoursPerMachine: 22,
    a1PlantBdPct: { '2025-01': '0.40%', '2025-07': NO_RECORDS },
    mtbfTc1: 238.2,
    mtbfVc2: null,
    workingHours: 3 * 11 * 525,
  },
  '2026': {
    from: '2026-01-01',
    to: '2026-12-31',
    noRecords: [],
    recordedMonths: 12,
    machines: 4,
    failures: 144 + 4,
    breakdownHours: 288,
    pmHours: 48,
    availableHours: 4 * 12 * 500,
    bdPct: 1.2,
    pmPct: 0.2,
    availabilityPct: 98.6,
    mttr: 1.95,
    mtbf: 160.2,
    observedDays: 350,
    breakdownsPerDay: 0.42,
    bdHoursPerDay: 0.82,
    bdHoursPerMachine: 72,
    a1PlantBdPct: { '2026-01': '1.20%', '2026-07': '1.20%' },
    mtbfTc1: 160.2,
    mtbfVc2: 160.2,
    workingHours: 4 * 12 * 525,
  },
  both: {
    from: '2025-01-01',
    to: '2026-12-31',
    noRecords: ['2025-07'],
    recordedMonths: 23,
    machines: 4,
    failures: 217,
    breakdownHours: 354,
    pmHours: 84,
    availableHours: 16_500 + 24_000,
    bdPct: 0.87,
    pmPct: 0.21,
    availabilityPct: 98.92,
    mttr: 1.63,
    mtbf: 185.0,
    observedDays: 361 + 354 - 31,
    breakdownsPerDay: 0.32,
    bdHoursPerDay: 0.52,
    bdHoursPerMachine: 88.5,
    a1PlantBdPct: {
      '2025-01': '0.40%',
      '2025-07': NO_RECORDS,
      '2026-01': '1.20%',
      '2026-07': '1.20%',
    },
    mtbfTc1: 190.1,
    mtbfVc2: 160.2,
    workingHours: 17_325 + 25_200,
  },
};
