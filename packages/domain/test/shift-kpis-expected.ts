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

/**
 * The shift split at 2026-11-11: the failure set's own rows grouped by the shift recorded on the report, and each
 * shift's working hours as its share of the plant's 5,93,977.0968. The day is 629 minutes of shift 1 and 631 of
 * shift 2 (the 18:29-18:30 overlap to the later start, DOMAIN section 5), so the shares add to the plant exactly.
 * A code the Settings have no window for keeps its own row and contributes no working hours.
 */
const SHIFT_MINUTES = { '1': 629, '2': 631, total: 1_260 } as const;

/** One shift's working hours: the plant's total times its own share of the day. */
const shiftHours = (code: '1' | '2'): number =>
  WORKING_HOURS * (SHIFT_MINUTES[code] / SHIFT_MINUTES.total);

/** 121,266 recorded minutes / 60 on shift 1 and 61,867 / 60 on shift 2. */
const SHIFT_1_HOURS = 121_266 / 60;
const SHIFT_2_HOURS = 61_867 / 60;
/** 34,277 PM minutes / 60 on shift 1 and 11,279 / 60 on shift 2: 45,556 / 60 together. */
const SHIFT_1_PM = 34_277 / 60;
const SHIFT_2_PM = 11_279 / 60;

export const SHIFT_SPLIT_EXPECTED = {
  /** The three codes the plant recorded: 1, 2 and 3 (no window in Settings). */
  codes: ['1', '2', '3'],
  rows: {
    '1': {
      breakdowns: 821,
      breakdownHours: SHIFT_1_HOURS,
      pmHours: SHIFT_1_PM,
      workingHours: shiftHours('1'),
      /** 2,021.10 / 821 = 2.4618. */
      mttr: SHIFT_1_HOURS / 821,
      /** (2,96,517.1380 - 2,021.10) / 821 = 358.7041. */
      mtbf: (shiftHours('1') - SHIFT_1_HOURS) / 821,
      /** 1 - (2,021.10 + 571.2833) / 2,96,517.1380 = 0.9912572. */
      availability: 1 - (SHIFT_1_HOURS + SHIFT_1_PM) / shiftHours('1'),
    },
    '2': {
      breakdowns: 456,
      breakdownHours: SHIFT_2_HOURS,
      pmHours: SHIFT_2_PM,
      workingHours: shiftHours('2'),
      /** 1,031.1167 / 456 = 2.2612. */
      mttr: SHIFT_2_HOURS / 456,
      /** (2,97,459.9588 - 1,031.1167) / 456 = 650.0633. */
      mtbf: (shiftHours('2') - SHIFT_2_HOURS) / 456,
      /** 1 - (1,031.1167 + 187.9833) / 2,97,459.9588 = 0.9959016. */
      availability: 1 - (SHIFT_2_HOURS + SHIFT_2_PM) / shiftHours('2'),
    },
    '3': {
      breakdowns: 2,
      /** 180 recorded minutes / 60 = 3.00. */
      breakdownHours: 180 / 60,
      pmHours: 0,
      workingHours: null,
      mttr: null,
      mtbf: null,
      availability: null,
    },
  },
  /** The page's own cells, in the header's order: only the BD hours add exactly at two decimals. */
  printed: {
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
    rows: [
      ['1 (08:00–18:29)', '821', '2,021.10', '571.28', '2,96,517.14', '2.46', '358.7', '99.13'],
      ['2 (18:29–05:00)', '456', '1,031.12', '187.98', '2,97,459.96', '2.26', '650.1', '99.59'],
      ['3 (no window)', '2', '3.00', '0.00', '—', '—', '—', '—'],
      ['PLANT TOTAL', '1,279', '3,055.22', '759.27', '5,93,977.10', '2.39', '462.0', '99.36'],
    ],
  },
} as const;

/**
 * The backlog fixture at 2026-11-11 (the answer key holds no open ticket, so this one is built): ages are working
 * minutes from `reportedAt` to the start of 12 November, on the Cosmos windows.
 */
export const SHIFT_BACKLOG_EXPECTED = {
  count: 3,
  /** T1: 17:00-18:29 (89) + 18:29-24:00 (331) on the 10th + the whole 11th (960) = 1,380 minutes = 23.0 hours. */
  t1: (89 + 331 + 960) / 60,
  /** T2: 09:00-18:29 (569) + 18:29-24:00 (331) on the 11th = 900 minutes = 15.0 hours. */
  t2: (569 + 331) / 60,
  /** T3: 20:00-24:00 (240) on the 9th + 960 + 960 = 2,160 minutes = 36.0 hours. */
  t3: (240 + 960 + 960) / 60,
  oldestWorkingHours: (240 + 960 + 960) / 60,
  buckets: { under4: 0, to24: 2, to72: 1, over72: 0 },
  /** Oldest first. */
  order: ['t3', 't1', 't2'],
} as const;
