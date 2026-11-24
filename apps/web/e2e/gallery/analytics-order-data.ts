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

/** Each screen: its path, its group's menu, and its own part after the shell and the menu. Empty: every analytics screen is v2 now, and each v2 screen has its own spec (`v2-*.spec.ts`; Compare went live in ticket 588). */
export const SCREENS: [string, string[], string[]][] = [];
