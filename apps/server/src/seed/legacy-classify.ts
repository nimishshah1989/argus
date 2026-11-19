import type { LegacyRow } from './legacy-sheets.js';

/**
 * Legacy workbooks, step two: every dated row gets exactly one class, in this order: bad date, stray year,
 * duplicate, gap month, unknown machine, utility, ticket (R1', R6'). The switches S1, S2, S4 decide the
 * borderline classes; S5 (code fold) is applied when a ticket is built. Pure: rows in, rows and counts out.
 */
export interface Switches {
  /** S1: Star sheet to machine code; empty means the Star sheets are excluded. */
  star: Record<string, string>;
  /** S2: keep the retired machines (their history loads) or drop them. */
  retired: 'drop' | 'keep';
  /** S4: `YYYY-MM` months held out as "no records". */
  gap: string[];
  /** S5: maintenance code to the code it folds into; empty keeps every code as written. */
  fold: Record<string, string>;
}

export const RETIRED_MACHINES = ['TC-2', 'VC-2', 'VC-3', 'VC-5'];
/** Bhavin, 19 Nov: Star 1 / Star-01 are S-1 and Star 2 / Star-02 are S-2; a bare Star stays out (S1). */
export const DEFAULT_SWITCHES: Switches = {
  star: { 'STAR-1': 'S-1', 'STAR-2': 'S-2' },
  retired: 'drop',
  gap: ['2022-02', '2022-03'],
  /** Bhavin, 19 Nov: MEC is M and ELE is E; every other code stays as written (S5). */
  fold: { MEC: 'M', ELE: 'E' },
};

export type RowClass =
  'bad_date' | 'stray_year' | 'duplicate' | 'gap_month' | 'unknown_machine' | 'utility' | 'ticket';

export interface ClassifiedRow {
  row: LegacyRow;
  /** The machine after the S1 switch. */
  machine: string;
  cls: RowClass;
  /** The row's place among all dated rows of its workbook year (R11): stable under every switch. */
  serial: number;
  /** The year of the row's own date. */
  dateYear: number | null;
}

export interface Counter {
  [key: string]: number;
}

/** The plan's own measured facts, over every dated row whatever its class (the real-file cross-check). */
export interface Measured {
  withDate: number;
  ownYear: number;
  otherYear: number;
  alreadyThere: number;
  noWorkbook: number;
  utilityRows: number;
  utilityHoursOnly: number;
  utilityDays: number;
  utilityMostOneDay: number;
  utilityHours: number;
  breakdowns: number;
  breakdownHours: number;
  pm: number;
  blankCode: number;
  blankMinutes: number;
  repeats: number;
}

export interface YearReport {
  year: number;
  read: number;
  badDate: number;
  movedOut: number;
  movedIn: number;
  duplicate: number;
  strayYear: number;
  unknownMachine: Counter;
  gapMonth: number;
  utilityRows: number;
  eventDays: number;
  tickets: number;
  events: number;
  possibleDuplicatePeople: number;
  strayShift: number;
  blankCode: number;
  blankMinutes: number;
  utiOnBreakdown: number;
  codes: Counter;
  /** Loaded rows (tickets and utility lines) per machine code. */
  machines: Counter;
  measured: Measured;
  identity: boolean;
}

const UTILITY_CODES = new Set(['UTI', 'UTY']);
const flat = (value: string): string => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const starKey = (name: string): string => name.toUpperCase().replace(/-0+(\d)/, '-$1');

export function isUtility(row: LegacyRow): boolean {
  return (
    UTILITY_CODES.has(row.code) ||
    UTILITY_CODES.has(row.elecMech) ||
    (row.utiHours > 0 && row.minutes === 0)
  );
}
export const isPm = (row: LegacyRow): boolean => row.code === 'PM';
const rowKey = (row: LegacyRow): string =>
  [row.machine, row.date, row.shift, row.minutes, flat(row.problem)].join('|');

function emptyMeasured(): Measured {
  return {
    withDate: 0,
    ownYear: 0,
    otherYear: 0,
    alreadyThere: 0,
    noWorkbook: 0,
    utilityRows: 0,
    utilityHoursOnly: 0,
    utilityDays: 0,
    utilityMostOneDay: 0,
    utilityHours: 0,
    breakdowns: 0,
    breakdownHours: 0,
    pm: 0,
    blankCode: 0,
    blankMinutes: 0,
    repeats: 0,
  };
}

function emptyReport(year: number): YearReport {
  return {
    year,
    read: 0,
    badDate: 0,
    movedOut: 0,
    movedIn: 0,
    duplicate: 0,
    strayYear: 0,
    unknownMachine: {},
    gapMonth: 0,
    utilityRows: 0,
    eventDays: 0,
    tickets: 0,
    events: 0,
    possibleDuplicatePeople: 0,
    strayShift: 0,
    blankCode: 0,
    blankMinutes: 0,
    utiOnBreakdown: 0,
    codes: {},
    machines: {},
    measured: emptyMeasured(),
    identity: true,
  };
}

const bump = (counter: Counter, key: string): void => {
  counter[key] = (counter[key] ?? 0) + 1;
};

/** Every dated row's key, per year: the "already in that year's workbook" test (R1'). */
function ownYearKeys(rows: readonly LegacyRow[]): Map<number, Set<string>> {
  const keys = new Map<number, Set<string>>();
  for (const row of rows) {
    if (row.date === null || Number(row.date.slice(0, 4)) !== row.year) continue;
    const set = keys.get(row.year) ?? new Set<string>();
    set.add(rowKey(row));
    keys.set(row.year, set);
  }
  return keys;
}

interface Context {
  years: Set<number>;
  known: Set<string>;
  keys: Map<number, Set<string>>;
  star: Map<string, string>;
  gap: Set<string>;
}

function classOf(row: LegacyRow, machine: string, context: Context): RowClass {
  if (row.date === null) return 'bad_date';
  const dateYear = Number(row.date.slice(0, 4));
  if (!context.years.has(dateYear)) return 'stray_year';
  if (dateYear !== row.year && context.keys.get(dateYear)?.has(rowKey(row))) return 'duplicate';
  if (context.gap.has(row.date.slice(0, 7))) return 'gap_month';
  if (!context.known.has(machine)) return 'unknown_machine';
  return isUtility(row) ? 'utility' : 'ticket';
}

function measureRow(m: Measured, c: ClassifiedRow, years: Set<number>): void {
  const { row, cls, dateYear } = c;
  m.withDate++;
  if (dateYear === row.year) m.ownYear++;
  else if (years.has(dateYear ?? 0)) m.otherYear++;
  else m.noWorkbook++;
  m.alreadyThere += cls === 'duplicate' ? 1 : 0;
  m.blankCode += row.code === '' ? 1 : 0;
  m.blankMinutes += row.blankMinutes ? 1 : 0;
  m.pm += isPm(row) ? 1 : 0;
}

function measure(rows: readonly ClassifiedRow[], report: YearReport, years: Set<number>): void {
  const m = report.measured;
  const perDay: Counter = {};
  const seen = new Set<string>();
  for (const c of rows) {
    const { row } = c;
    if (row.date === null) continue;
    measureRow(m, c, years);
    const key = `${rowKey(row)}|${row.shift}`;
    m.repeats += seen.has(key) ? 1 : 0;
    seen.add(key);
    if (isUtility(row)) {
      m.utilityRows++;
      m.utilityHoursOnly += row.utiHours > 0 && row.minutes === 0 ? 1 : 0;
      m.utilityHours += row.utiHours > 0 ? row.utiHours : row.minutes / 60;
      bump(perDay, row.date);
    } else if (!isPm(row) && row.minutes > 0) {
      m.breakdowns++;
      m.breakdownHours += row.minutes / 60;
    }
  }
  m.utilityDays = Object.keys(perDay).length;
  m.utilityMostOneDay = Math.max(0, ...Object.values(perDay));
  m.utilityHours = Math.round(m.utilityHours);
  m.breakdownHours = Math.round(m.breakdownHours);
}

function tallyTicket(report: YearReport, row: LegacyRow): void {
  report.tickets++;
  bump(report.codes, row.code === '' ? '(blank)' : row.code);
  report.blankCode += row.code === '' ? 1 : 0;
  report.blankMinutes += row.blankMinutes ? 1 : 0;
  report.utiOnBreakdown += row.utiHours > 0 && row.minutes > 0 ? 1 : 0;
}

const CLASS_COUNT: Partial<Record<RowClass, 'duplicate' | 'strayYear' | 'gapMonth'>> = {
  duplicate: 'duplicate',
  stray_year: 'strayYear',
  gap_month: 'gapMonth',
};

function tally(
  rows: readonly ClassifiedRow[],
  report: YearReport,
  all: readonly ClassifiedRow[],
): void {
  const utilityDays = new Set<string>();
  for (const { row, machine, cls, dateYear } of rows) {
    if (cls === 'bad_date') report.badDate++;
    else report.read++;
    const field = CLASS_COUNT[cls];
    if (field) report[field]++;
    if (cls === 'unknown_machine') bump(report.unknownMachine, machine);
    if (cls === 'ticket' || cls === 'utility') {
      report.movedOut += dateYear !== row.year ? 1 : 0;
      bump(report.machines, machine);
    }
    if (cls === 'utility') {
      report.utilityRows++;
      utilityDays.add(row.date ?? '');
    }
    if (cls === 'ticket') tallyTicket(report, row);
  }
  report.eventDays = utilityDays.size;
  report.movedIn = all.filter(
    (c) =>
      (c.cls === 'ticket' || c.cls === 'utility') &&
      c.dateYear === report.year &&
      c.row.year !== report.year,
  ).length;
}

export function classifyLegacy(
  rows: readonly LegacyRow[],
  machines: ReadonlySet<string>,
  switches: Switches,
): { rows: ClassifiedRow[]; reports: YearReport[] } {
  const years = new Set(rows.map((row) => row.year));
  const context: Context = {
    years,
    known: new Set([...machines, ...(switches.retired === 'keep' ? RETIRED_MACHINES : [])]),
    keys: ownYearKeys(rows),
    star: new Map(Object.entries(switches.star).map(([k, v]) => [starKey(k), v])),
    gap: new Set(switches.gap),
  };
  const serials = new Map<number, number>();
  const classified = rows.map((row): ClassifiedRow => {
    const serial = (serials.get(row.year) ?? 0) + 1;
    serials.set(row.year, serial);
    const machine = context.star.get(starKey(row.machine)) ?? row.machine;
    const dateYear = row.date === null ? null : Number(row.date.slice(0, 4));
    return { row, machine, cls: classOf(row, machine, context), serial, dateYear };
  });
  const reports = [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const own = classified.filter((c) => c.row.year === year);
      const report = emptyReport(year);
      tally(own, report, classified);
      measure(own, report, years);
      const gone =
        report.duplicate + report.strayYear + report.gapMonth + sum(report.unknownMachine);
      report.identity = report.read === report.tickets + report.utilityRows + gone;
      return report;
    });
  return { rows: classified, reports };
}

const sum = (counter: Counter): number => Object.values(counter).reduce((a, b) => a + b, 0);
