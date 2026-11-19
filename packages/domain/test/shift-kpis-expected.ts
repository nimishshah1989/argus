/**
 * The standard (working-hours) figures for the 11 November workbook, hand-computed over
 * `fixtures/answer-key/input.json` at `asOf` 2026-11-11. This file is not the answer key: the key holds what the
 * platform itself printed, and this file holds the arithmetic the second definition performs on the same rows.
 *
 * The three data facts it uses: 125 production machines, 1,279 non-PM history rows, and the plant's two shift
 * windows (08:00-18:30 and 18:29-05:00, the 18:29-18:30 overlap belonging to the later shift, DOMAIN section 5).
 */

/** The fixture's summed `periodFraction` from 1 January to 11 November, each machine from its purchase date. */
const FRACTION = 94.28207885304666;

/** 6,300 = 21.0 working hours a day (629 + 631 minutes) times 300 working days. */
const WORKING_HOURS = 6_300 * FRACTION;
/** The legacy basis: 20 hours by 300 days, the workbook constant, over the same fractions. */
const LEGACY_HOURS = 6_000 * FRACTION;

/** 183,313 recorded minutes / 60; the NO DT rows' 12,546 minutes are not lost time. */
const BREAKDOWN_HOURS = 183_313 / 60;
/** 45,556 recorded minutes / 60 over the 64 PM rows. */
const PM_HOURS = 45_556 / 60;

export const SHIFT_KPIS_EXPECTED = {
  /** 629 (08:00-18:29) + 631 (18:29-05:00). */
  minutesPerDay: 1_260,
  annualHours: 6_300,
  workingHours: WORKING_HOURS,
  legacyWorkingHours: LEGACY_HOURS,
  breakdownHours: BREAKDOWN_HOURS,
  pmHours: PM_HOURS,
  failures: 1_279,
  machines: 125,
  machinesWithoutFailure: 8,
  /** 3,055.2167 / 1,279 = 2.3888. */
  mttr: BREAKDOWN_HOURS / 1_279,
  /** (5,93,977.0968 - 3,055.2167) / 1,279 = 462.0187. */
  mtbf: (WORKING_HOURS - BREAKDOWN_HOURS) / 1_279,
  /** 1 - (3,055.2167 + 759.2667) / 5,93,977.0968 = 0.9935781. */
  availability: 1 - (BREAKDOWN_HOURS + PM_HOURS) / WORKING_HOURS,
  /** 3,055.2167 / 5,93,977.0968 = 0.0051437. */
  bdPct: BREAKDOWN_HOURS / WORKING_HOURS,
  /** 759.2667 / 5,93,977.0968 = 0.0012783. */
  pmPct: PM_HOURS / WORKING_HOURS,
  /** The cells the comparison prints for the working-hour basis, at their own decimals. */
  printed: {
    workingHours: '5,93,977.10',
    mtbf: '462.0',
    mttr: '2.39',
    availability: '99.36',
    bdPct: '0.51',
    pmPct: '0.13',
  },
} as const;
