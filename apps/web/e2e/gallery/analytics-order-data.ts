/**
 * What each analytics screen lists: every control, heading and chart `summary`, top to bottom (see analytics-order.spec.ts).
 * Read off the screens BEFORE the 87 restyle (`git show d3fbd43b`), then re-read with `summary` added. The old screens
 * and the new differ in exactly two ways, all deliberate: the charts' summaries come before the tables (charts first,
 * as on Reports and Money); the shift-calendar page has one h2 and an h3 per figure.
 */
export const SHELL_PHONE = [
  'button: Menu',
  'select: Period',
  'button: SearchCtrl K',
  'a: Today',
  'a: Machines',
  'a: Problems',
  'a: Reliability ',
  'a: People & mon',
  'a: Reports',
  'a: Guide',
  'a: Desk',
];
export const SHELL_WIDE = SHELL_PHONE.slice(1);
const BREAKDOWNS_MENU = [
  'h1: Problems',
  'a: Breakdown lo',
  'a: A1 breakdown',
  'a: A2 category ',
  'a: A3 MTTR and ',
  'a: A4 manpower',
  'a: A6 Why-Why',
  'a: A10 problem ',
  'a: Fix Finder',
  'a: Shift-calend',
];
const MACHINES_MENU = [
  'h1: Machines',
  'a: Registers an',
  'a: Cell change ',
  'a: A7 footprint',
  'a: A8 age analy',
  'a: Compare mach',
  'a: A5 energy he',
];

/** Each screen: its path, its group's menu, and its own part after the shell and the menu. */
export const SCREENS: [string, string[], string[]][] = [
  [
    '/analytics/breakdowns?screen=a1-bd-pm',
    BREAKDOWNS_MENU,
    [
      'h2: Breakdown ag',
      'summary: Show the num',
      'summary: Show the num',
      'h3: By cell',
      'h3: By month',
      'a: See the rows',
    ],
  ],
  [
    '/analytics/breakdowns?screen=a2-category-cell',
    BREAKDOWNS_MENU,
    ['h2: Category and', 'summary: Show the num', 'h3: By category'],
  ],
  [
    '/analytics/breakdowns?screen=a3-mttr-mtbf',
    BREAKDOWNS_MENU,
    ['h2: MTTR and MTB', 'summary: Show the num', 'h3: By category'],
  ],
  [
    '/analytics/breakdowns?screen=a4-manpower',
    BREAKDOWNS_MENU,
    [
      'h2: Manpower',
      'summary: Show the num',
      'h3: Manpower Tab',
      'button: Person',
      'button: Hours',
      'h3: Specializati',
      'button: By Category',
      'button: By Fault Cod',
    ],
  ],
  [
    '/analytics/machines?screen=compare',
    MACHINES_MENU,
    [
      'h2: Compare mach',
      'summary: Show the num',
      'summary: Show the num',
      'h3: Scorecard',
      'h3: Checkup',
      'h3: Specificatio',
      'h3: Longest brea',
      'button: Date',
      'button: Hours',
    ],
  ],
];
