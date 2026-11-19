/**
 * The reliability fits and the critical-spares lists for the 11 November workbook, computed over
 * `fixtures/answer-key/input.json` at `asOf` 2026-11-11 with the plant's two shift windows. This file is not the
 * answer key (the key holds what the platform printed); it holds the arithmetic tickets 67 and its plan perform on
 * the same rows, so a reader can check the test without running it.
 *
 * The two quantities every number rests on:
 *
 * - **The clock.** 21.0 working hours a day (629 + 631 minutes) x 300 days = 6,300 a machine a year, spread month by
 *   month from 1 January: 16.935483871 h in a 31-day month, 17.5 in a 30-day month, 18.75 in February.
 * - **The observations.** A failure event is one plant date with at least one of 48's failure reports. A machine's
 *   fit has `E - 1` complete intervals between its events and one right-censored tail from its last event to asOf.
 *
 * The plan printed these from two throwaway implementations that share no code (a golden-section profile-likelihood
 * search in Node and a score-equation bisection in Python). Their shapes agree to better than 1e-7; their scales
 * differ by up to 3e-6 on the 4-interval TC-17 fit, and it is the scale that carries the difference, because a
 * Weibull scale amplifies a shape error by up to ~500 on these samples. The tests therefore pin the shape to 1e-6
 * and the scale and mean to 5e-6 absolute — the reference's own spread, not a looser one. The Kaplan-Meier steps are
 * pinned to 1e-9 on the survival and 1e-6 on the interval (the plan prints its intervals to six decimals).
 */

/** The fixture's summed `periodFraction` from 1 January to 11 November, each machine from its purchase date. */
const FRACTION = 94.28207885304666;

/** 6,300 working hours a year x the 125 machines' fractions. */
const WORKING_HOURS = 6_300 * FRACTION;

export const RELIABILITY_EXPECTED = {
  asOf: '2026-11-11',
  windowStart: '2026-01-01',
  minimumEvents: 5,
  /** `isProduction`: the 126 CNC rows less the one excluded machine. */
  machines: 125,
  /**
   * 48's failure set in the window: 1,279 reports on 1,185 distinct machine-dates (94 same-date repeats on 46
   * machines), across 117 machines; 8 production machines have no failure at all.
   */
  reports: 1_279,
  events: 1_185,
  machinesWithFailure: 117,
  machinesWithoutFailure: 8,
  sameDateRepeats: 94,
  machinesWithRepeat: 46,
  /** 6,300 x 94.282078853 = 5,93,977.0968 h, the same plant total 48's comparison prints. */
  workingHours: WORKING_HOURS,
  /** 5 or more events: 83 machines fit their own; 36 borrow their category's fit; 6 have neither. */
  ownFits: 83,
  categoryFits: 36,
  insufficient: 6,
  /** The categories with 5+ pooled events and 4+ pooled intervals. */
  categories: 10,

  hmc2: {
    /** 50 reports on 43 distinct dates (7 same-date repeats); bought 2006-10-01 so its window is the full year. */
    events: 43,
    completeIntervals: 42,
    /** H(2026-11-11) - H(2026-11-07) = 4 November days x 17.5 = 70 h. */
    censoredHours: 70,
    /** m = 42, Σ ln x_i = 171.405070754; at the solution S = 2,555.853225 and S1 = 13,337.630929. */
    shape: 0.879204344,
    scale: 107.012214493,
    /** λ x Γ(1 + 1/k) = 107.012214493 x 1.066089 = 114.085658462. */
    meanHours: 114.085658462,
    /** The same 42 intervals with the tail dropped: k 0.872804221, λ 104.576012925. */
    uncensored: { shape: 0.872804221, scale: 104.576012925 },
    /**
     * The product-limit steps at their own times: 8 tied intervals at 16.935484 leave S = 35/43; the tail (70 h)
     * is censored and never a step. S crosses a half at 51.370968 (0.511628 before, 0.488372 after), not at
     * 52.5 — the plan's prose says 52.5, its own step line says 0.418605 at 52.5, and 51.370968 is the first
     * step at or below a half under the rule the plan states.
     */
    steps: [
      [16.935483871, 0.813953488],
      [18.75, 0.720930233],
      [50.806451613, 0.511627907],
      [51.370967742, 0.488372093],
      [52.5, 0.418604651],
      [135.483870968, 0.222383721],
      [677.419354839, 0],
    ],
    quartiles: { q25: 18.75, median: 51.370967742, q75: 135.483870968 },
    /** β = 43 / Σ ln(5,442.5 / t_i) = 43 / 24.785022 = 1.734918780; se = 1.734918780 / √43 = 0.264572634. */
    trend: { beta: 1.73491878, n: 43, label: 'worsening' },
    /** 1 - 1.734918780 = 0.734918780 > 2 x 0.264572634 = 0.529145267, so the word is "failures are coming faster". */
    spares: [
      {
        name: 'Rectifier O/P 440V AC and I/P 190V DC',
        uses: 1,
        downtimeHours: 4,
        lastOn: '2026-09-16',
      },
      {
        name: 'Rectifier 440 O/P and I/P 190 VDC',
        uses: 1,
        downtimeHours: 3,
        lastOn: '2026-07-18',
      },
      { name: 'Break Rectifier 2 amp', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
      { name: 'Brake hub', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
    ],
    /** The four parts sit on three reports: the two NO DT parts share 2026-10-03's. */
    spareReports: 3,
  },

  tc17: {
    /** Five events: 08-04, 08-06, 08-07, 09-14 and 09-22. */
    events: 5,
    completeIntervals: 4,
    /** H(2026-11-11) - H(2026-09-22) = 857.5 h, 15.8 % of its 5,442.5-hour exposure. */
    censoredHours: 857.5,
    /** The intervals are 33.870968, 16.935484, 651.451613 and 140 h; m = 4, Σ ln x = 17.772815. */
    shape: 0.612598299,
    scale: 373.227247135,
    meanHours: 546.847940621,
    /** With the tail dropped the same four intervals give k 0.749347716, λ 174.393231985 (mean 207.788497). */
    uncensored: { shape: 0.749347716, scale: 174.393231985 },
    /** The hand check: risk sets 5, 4, 3, 2 and S = 4/5 x 3/4 x 2/3 x 1/2 = 0.8, 0.6, 0.4, 0.2. */
    steps: [
      [16.935483871, 0.8],
      [33.870967742, 0.6],
      [140, 0.4],
      [651.451612903, 0.2],
    ],
    quartiles: { q25: 33.870967742, median: 140, q75: 651.451612903 },
    /** β = 5 / 1.474675 = 3.390578197, se = 3.390578197 / √5 = 1.516312666; 2.390578 < 3.032625, so no clear trend. */
    trend: { beta: 3.390578197, n: 5, label: 'no_clear_trend' },
    spares: [
      { name: '1 Amp glass fuse', uses: 1, downtimeHours: 136 / 60, lastOn: '2026-08-06' },
      { name: 'Fanuc battery 6 V', uses: 1, downtimeHours: 1.75, lastOn: '2026-09-14' },
      { name: 'Glass tube fuse 2 Amp', uses: 1, downtimeHours: 1, lastOn: '2026-09-22' },
    ],
  },

  turningCenter: {
    /** 38 machines pool; 35 carry an event (their tails are in the likelihood), 31 of them two or more. */
    machines: 38,
    machinesWithEvents: 35,
    events: 260,
    completeIntervals: 225,
    /** 260 events - 35 machines with an event = 225 intervals; the 35 tails sum to 20,979.112903 h. */
    censoredHours: 20_979.112903226,
    /** m = 225, Σ ln x = 1,195.762945. */
    shape: 0.812341247,
    scale: 493.425375085,
    meanHours: 553.062708887,
    /** Without the tails: k 0.817229, λ 391.654111. */
    uncensored: { shape: 0.817229, scale: 391.654111 },
    quartiles: { q25: 101.612903226, median: 274.35483871, q75: 701.129032258 },
    /** β = 260 / 233.255550 = 1.114657295, se = 0.069128111; 0.114657 < 0.138256, so no clear trend. */
    trend: { beta: 1.114657295, n: 260, label: 'no_clear_trend' },
  },

  /** The other two large categories the plan prints, to prove the pool is per category and not the plant. */
  verticalMachiningCenter: {
    shape: 0.798139904,
    scale: 322.3818767,
    meanHours: 365.870264118,
    quartiles: { q25: 54.435483871, median: 169.35483871, q75: 477.580645161 },
    trend: { beta: 1.134347186, n: 588, label: 'worsening' },
  },
  horizontalMachiningCenter: {
    shape: 0.897943016,
    scale: 140.975753213,
    meanHours: 148.518575402,
    quartiles: { q25: 33.870967742, median: 70, q75: 203.225806452 },
    trend: { beta: 2.077150037, n: 78, label: 'worsening' },
  },

  /** The four small categories' six machines: own events, the category and the category's pooled events. */
  insufficientMachines: [
    { id: 'CAM-01', ownEvents: 0, category: 'CAM Profile Machine', categoryEvents: 0 },
    { id: 'GRD-1', ownEvents: 2, category: 'Cylinderical rotary Grinding', categoryEvents: 2 },
    { id: 'GRD-5', ownEvents: 0, category: 'CNC Internal Grinding', categoryEvents: 4 },
    { id: 'GRD-7', ownEvents: 2, category: 'Centerless Grinding Machine', categoryEvents: 2 },
    { id: 'GRD-8', ownEvents: 3, category: 'CNC Internal Grinding', categoryEvents: 4 },
    { id: 'GRD-9', ownEvents: 1, category: 'CNC Internal Grinding', categoryEvents: 4 },
  ],

  /** TC-24 (4 events) and VC-57 (bought 2026-10-31, no failure) read the Turning/Vertical pool. */
  tc24: { id: 'TC-24', ownEvents: 4, category: 'Turning Center', tickets: 4 },
  vc57: { id: 'VC-57', ownEvents: 0, category: 'Vertical Machining Center' },

  spares: {
    /** 215 reports carry a spare field (236 fields, 205 distinct spellings); 30 "No" and 1 "Yes" name no part. */
    reportsWithField: 215,
    fields: 236,
    spellings: 205,
    droppedNo: 30,
    droppedYes: 1,
    /** The rule leaves a listed part on 181 reports across 67 machines; 58 production machines list none. */
    reportsWithPart: 181,
    machinesWithPart: 67,
    machinesWithoutPart: 58,
    /** WJ-01: 23 reports (22 distinct dates), 15 parts, the top five by uses then downtime. */
    wj01: {
      reports: 23,
      total: 15,
      rows: [
        { name: 'Seal 20422243', uses: 2, downtimeHours: 797 / 60, lastOn: '2026-10-13' },
        { name: '10110393 and 20422243', uses: 2, downtimeHours: 365 / 60, lastOn: '2026-07-16' },
        { name: '80086622 Seal', uses: 1, downtimeHours: 9, lastOn: '2026-10-13' },
        { name: 'Seal 50056849', uses: 1, downtimeHours: 257 / 60, lastOn: '2026-08-01' },
        { name: `1" transperant pipe`, uses: 1, downtimeHours: 4.25, lastOn: '2026-05-01' },
      ],
    },
  },
} as const;
