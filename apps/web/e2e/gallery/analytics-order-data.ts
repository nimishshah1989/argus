/** What each analytics screen listed before the 87 restyle: every control and heading, top to bottom (see analytics-order.spec.ts). */
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

/** The screen's own part: after the shell and the group's menu. */
export const SCREENS: [string, string[], string[]][] = [
  [
    '/analytics/breakdowns?screen=a1-bd-pm',
    BREAKDOWNS_MENU,
    ['h2: Breakdown ag', 'h3: By cell', 'h3: By month', 'a: See the rows'],
  ],
  [
    '/analytics/breakdowns?screen=a2-category-cell',
    BREAKDOWNS_MENU,
    ['h2: Category and', 'h3: By category'],
  ],
  [
    '/analytics/breakdowns?screen=a3-mttr-mtbf',
    BREAKDOWNS_MENU,
    ['h2: MTTR and MTB', 'h3: By category'],
  ],
  [
    '/analytics/breakdowns?screen=a4-manpower',
    BREAKDOWNS_MENU,
    [
      'h2: Manpower',
      'h3: Manpower Tab',
      'button: Person',
      'button: Hours',
      'h3: Specializati',
      'button: By Category',
      'button: By Fault Cod',
    ],
  ],
  [
    '/analytics/breakdowns?screen=a10-problems',
    BREAKDOWNS_MENU,
    [
      'h2: Problem Anal',
      'h3: Problem grou',
      'button: Problem grou',
      'button: Count',
      'h3: Entries the ',
      'button: Date',
      'button: Machine',
      'button: Problem',
      'button: Hours',
      'button: Group',
      'button: Accept',
      'h3: Problem grou',
    ],
  ],
  [
    '/analytics/breakdowns?screen=fix-finder',
    BREAKDOWNS_MENU,
    ['h2: Fix Finder', 'h3: Similar brea', 'button: Ticket', 'button: Machine', 'button: Fix'],
  ],
  [
    '/analytics/breakdowns?screen=shift-kpis',
    BREAKDOWNS_MENU,
    // Deliberate (one h2 a screen): the screen's name is the h2, and the two figures' titles are h3s under it.
    ['h2: Shift-calend', 'h3: Shift compar', 'h3: By shift', 'h3: Backlog', 'h3: Open at shif'],
  ],
  [
    '/analytics/machines?screen=compare',
    MACHINES_MENU,
    [
      'h2: Compare mach',
      'h3: Scorecard',
      'h3: Checkup',
      'h3: Specificatio',
      'h3: Longest brea',
      'button: Date',
      'button: Hours',
    ],
  ],
  [
    '/analytics/machines?screen=cell-change-log',
    MACHINES_MENU,
    [
      // Deliberate: the screen had no heading; it now has its one h2, the name its menu entry carries.
      'h2: Cell change ',
      'button: Export to CS',
      'a: CNC-01',
      'button: Correct date',
      'a: DRL-04',
      'button: Correct date',
    ],
  ],
];
