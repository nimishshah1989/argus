import type { AnalyticsProfile } from '@uptimo/shared';
import { availableHours, daysInclusive, periodFraction } from './availability.js';
import { formatNumber, formatPercent, normalizeLabel } from './format.js';
import { cellAt, NO_CELL } from './hours.js';
import { isProduction } from './machine-facts.js';
import { dayNumber, dmy } from './plant-date.js';
import { effectiveHours, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { EngineData, ListRow, MachineRow } from './types.js';

/**
 * The rules the monthly and annual reports share (ticket 45, packets 45a and 45b): the report period and its
 * comparison, the fraction and available hours, one window's stats, the grouping order, the machine/cell/code
 * labels and the number and arrow text the key pins. Nothing here builds a table or a chart; those belong to the
 * monthly report (45a) and the annual report (45b).
 */

/** A calendar month's full name, the label every report header prints. */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** The chart's short month label (`Jan`). */
export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** No cell, no code and an absent value all print as this dash. */
export const DASH = '—';

/** The platform's `periodFrac`: the month-by-month share of a year a span covers. */
export const fraction = periodFraction;

/** The profile's annual hours per machine (`prodHrsPerDay × workDaysPerYear`). */
export const annualHours = (
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
): number => profile.prodHrsPerDay * profile.workDaysPerYear;

/** One calendar month, its full-plant-date window and its printed label. */
export interface MonthWindow {
  year: number;
  /** 1 = January. */
  month: number;
  start: string;
  end: string;
  label: string;
}

/** The report month and the month before it, both in full. */
export interface MonthPeriod {
  current: MonthWindow;
  previous: MonthWindow;
}

/** The month's last day, as a plant date. */
function monthEnd(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** One calendar month in full: `2026-10-01` to `2026-10-31`, printed `October 2026`. */
export function monthWindow(year: number, month: number): MonthWindow {
  const number = ((month - 1 + 12) % 12) + 1;
  const shifted = year + Math.floor((month - 1) / 12);
  return {
    year: shifted,
    month: number,
    start: `${shifted}-${String(number).padStart(2, '0')}-01`,
    end: monthEnd(shifted, number),
    label: `${MONTH_NAMES[number - 1]} ${shifted}`,
  };
}

/**
 * The monthly report's period: the complete month before `asOf`'s month, compared with the month before that,
 * both used in full. The plan fixes the key's monthly report to October 2026 for an 11 November run.
 */
export function monthlyPeriod(asOf: string): MonthPeriod {
  const [year = 0, month = 1] = asOf.split('-').map(Number);
  const index = year * 12 + month - 1;
  return {
    current: monthWindow(Math.floor((index - 1) / 12), ((index - 1) % 12) + 1),
    previous: monthWindow(Math.floor((index - 2) / 12), ((index - 2) % 12) + 1),
  };
}

/** The production fleet the reports count: CNC machines the plant has not excluded. */
export const productionMachines = (data: EngineData): MachineRow[] =>
  data.machines.filter(isProduction);

/** Every report whose machine is in the production fleet, in the order the snapshot reads them. */
export function reportEntries(data: EngineData): SourcedReport[] {
  const production = new Set(productionMachines(data).map((machine) => machine.id));
  return sourcedReports(data).filter((row) => production.has(row.report.machineId));
}

/** One group of reports: its key, its count and its unrounded hours. */
export interface ReportGroup {
  key: string;
  n: number;
  h: number;
}

/** The platform's hours for a run of reports, summed before any rounding. */
export const sumHours = (rows: readonly SourcedReport[]): number =>
  rows.reduce((total, row) => total + effectiveHours(row.report), 0);

/** The platform's group order: hours descending, then count descending, ties in first-appearance order. */
export function sortGroups(groups: readonly ReportGroup[]): ReportGroup[] {
  return [...groups].sort((left, right) => right.h - left.h || right.n - left.n);
}

/** Group reports by a label key, dropping a row whose key is absent; first-appearance order feeds the sort. */
export function groupBy(
  rows: readonly SourcedReport[],
  keyOf: (row: SourcedReport) => string | null,
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null || key === '') continue;
    const group = groups.get(key) ?? { key, n: 0, h: 0 };
    group.n += 1;
    group.h += effectiveHours(row.report);
    groups.set(key, group);
  }
  return sortGroups([...groups.values()]);
}

/** The span a report's stats cover, both ends included. */
export interface ReportWindow {
  from: string;
  to: string;
}

/** One window's report arithmetic: its counts, hours, available hours, BD %, PM % and availability. */
export interface ReportStats {
  start: string;
  end: string;
  days: number;
  fraction: number;
  available: number;
  breakdowns: SourcedReport[];
  pm: SourcedReport[];
  count: number;
  hours: number;
  pmCount: number;
  pmHours: number;
  mttr: number;
  mtbf: number;
  bdPct: number;
  pmPct: number;
  avail: number;
}

/**
 * A window's stats, the platform's `repStats`: PM is never a breakdown, NO DT is a breakdown worth no hours, the
 * available hours are the production fleet's share of the annual hours, and every figure is computed before any
 * rounding. The available basis is the same one tickets 38 to 43 use.
 */
export function reportStats(
  entries: readonly SourcedReport[],
  machines: readonly MachineRow[],
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
  window: ReportWindow,
): ReportStats {
  const { from, to } = window;
  const inPeriod = entries.filter((row) => row.report.date >= from && row.report.date <= to);
  const breakdowns = inPeriod.filter((row) => !isPm(row));
  const pm = inPeriod.filter(isPm);
  const hours = sumHours(breakdowns);
  const pmHours = sumHours(pm);
  const annual = annualHours(profile);
  const available = machines.reduce(
    (total, machine) => total + availableHours(machine, annual, from, to),
    0,
  );
  const count = breakdowns.length;
  return {
    start: from,
    end: to,
    days: daysInclusive(from, to),
    fraction: fraction(from, to),
    available,
    breakdowns,
    pm,
    count,
    hours,
    pmCount: pm.length,
    pmHours,
    mttr: count > 0 ? hours / count : 0,
    mtbf: count > 0 ? (available - hours) / count : available,
    bdPct: available > 0 ? hours / available : 0,
    pmPct: available > 0 ? pmHours / available : 0,
    avail: available > 0 ? 1 - hours / available - pmHours / available : 0,
  };
}

/** A machine cell: its id, then the model cut to 15 characters plus an ellipsis when it is longer than 16. */
export function machineLabel(machine: MachineRow | undefined, id: string): string {
  const model = machine?.model?.trim() ?? '';
  if (model === '') return id;
  return `${id} ${model.length > 16 ? `${model.slice(0, 15)}…` : model}`;
}

/** A cell key as the report prints it: `Cell 2`, or `No cell` for a blank or unlisted cell. */
export function cellName(key: string): string {
  return key === NO_CELL ? 'No cell' : `Cell ${key}`;
}

/**
 * The cell a report groups under: the cell the machine was in on the report's date (the move log), with a blank or
 * unlisted cell folded into `—` so the report's cells add up.
 */
export function cellGroupKey(
  machine: MachineRow,
  moves: EngineData['moves'],
  date: string,
  cells: readonly string[],
): string {
  const cell = cellAt(machine, moves, date);
  return cell === NO_CELL || !cells.includes(cell) ? NO_CELL : cell;
}

/** A maintenance code's list label, up to the em dash the platform truncates at. */
export function codeDescription(code: string, lists: Record<string, ListRow[]>): string {
  if (code === DASH) return 'no code recorded';
  const found = lists.maint_code?.find((item) => item.code === code);
  return found === undefined ? '' : found.label.split('—')[0]!.trim();
}

/** A code cell: the code and its list label, or `(none) no code recorded` for a blank code. */
export function codeLabel(code: string, lists: Record<string, ListRow[]>): string {
  if (code === DASH) return '(none) no code recorded';
  const description = codeDescription(code, lists);
  return description === '' ? code : `${code} ${description}`;
}

/** The days in a calendar month, the month's own length whatever the year. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The purchase date of a machine that has one; a year-only machine never joins a report's fleet. */
export function boughtOn(machine: MachineRow): string | null {
  const bought = machine.purchasedOn?.slice(0, 10) ?? null;
  return bought !== null && dayNumber(bought) !== null ? bought : null;
}

/** A machine's category label with its whitespace collapsed, or null when the row has no category. */
export const categoryName = (machine: MachineRow): string | null =>
  machine.category === null ? null : normalizeLabel(machine.category);

/** The category a machine is counted under in a fleet table, including the unclassified bucket. */
export const categoryOf = (machine: MachineRow): string => categoryName(machine) ?? '(no category)';

/** The category order the reports print: machine count descending, ties in first-appearance order. */
export function categoriesOf(machines: readonly MachineRow[]): string[] {
  const counts = new Map<string, number>();
  for (const machine of machines) {
    const category = categoryOf(machine);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts].sort((left, right) => right[1] - left[1]).map(([category]) => category);
}

/** The platform's written date (`DD-MM-YYYY`). */
export const dateText = dmy;

/** Hours are one decimal everywhere except where a table asks for whole hours. */
export const hoursText = (value: number): string => formatNumber(value, 1);

/** A count is whole and grouped. */
export const countText = (value: number): string => formatNumber(value, 0);

/** A share is a fraction printed as one decimal of a percent. */
export const shareText = (part: number, whole: number): string =>
  whole === 0 ? DASH : `${formatNumber((part / whole) * 100, 1)}%`;

/** BD % and availability print two decimals. */
export const percentText = (value: number): string => formatPercent(value);

/** A previous-period cell: its number, or the dash when there is no comparison period at all. */
export const previousText = (text: string, hasPrev: boolean): string => (hasPrev ? text : DASH);

/** Hours change: nothing under 0.05 prints a dash; otherwise an arrow and one decimal, never a sign. */
export function hoursDelta(current: number, previous: number, hasPrev: boolean): string {
  if (!hasPrev) return DASH;
  const difference = current - previous;
  if (Math.abs(difference) < 0.05) return DASH;
  return `${difference > 0 ? '▲' : '▼'} ${formatNumber(Math.abs(difference), 1)}`;
}

/** A count change: `no change` at zero, otherwise an arrow, a sign and a whole number. */
export function countDelta(current: number, previous: number, hasPrev: boolean): string {
  if (!hasPrev) return DASH;
  const difference = current - previous;
  if (difference === 0) return 'no change';
  return `${difference > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(difference), 0)}`;
}

/** A team's hours change: `no change` under 0.05, otherwise an arrow, a sign and one decimal. */
export function teamHoursDelta(current: number, previous: number, hasPrev: boolean): string {
  if (!hasPrev) return DASH;
  const difference = current - previous;
  if (Math.abs(difference) < 0.05) return 'no change';
  return `${difference > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(difference), 1)}`;
}
