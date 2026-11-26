/** The v2 kit shell and the wide Settings menu that board-settings-order-data.ts lists first on each screen. */
export const SHELL = [
  'a: Today',
  'a: Machines',
  'a: Problems',
  'a: Reliability ',
  'a: People & mon',
  'a: Reports',
  'a: Guide',
  'a: Desk',
  'button: Menu',
  'h1: Settings',
  'button: SearchCtrl K',
  'button: Alerts',
];
/** The live board sits in the same shell (S30, ADR 0055/0056), under its own title. */
export const BOARD_SHELL = SHELL.map((c) => (c === 'h1: Settings' ? 'h1: Live board' : c));
export const MENU = [
  'h3: Desk',
  'a: Open',
  'a: Live',
  'h3: Plant',
  'a: Machines',
  'a: Segments and',
  'a: Shifts',
  'a: PM plans',
  'a: Asset regist',
  'a: Duty roster',
  'a: Escalation l',
  'a: People',
  'a: Logins',
  'a: Audit trail',
  'a: Background j',
  'a: Lists',
  'a: Glossary',
  'a: Company',
  'a: Analytics pr',
  'a: Translations',
];
