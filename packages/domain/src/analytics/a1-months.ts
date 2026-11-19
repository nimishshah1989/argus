import {
  monthLabel,
  NO_RECORDS,
  yearLabel,
  type Period,
  type PeriodMonth,
} from './availability.js';
import { formatInr } from './format.js';
import {
  availableByCell,
  availableHoursFor,
  NO_CELL,
  quarterAverage,
  type HoursWindow,
} from './hours.js';
import type { SourcedReport } from './rows.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * A1's month tables (ticket 40, packet 40b; moved out of `a1-bd-pm.ts` by ticket 76, packet 76g): the percent table,
 * the BD-hours and PM-hours tables, and the monthly rows and series they and the trend chart read.
 */

export const MONTHS = [
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
];
const DASH = '—';

export function inr(value: number, decimals: number): string {
  return formatInr(Number(value.toFixed(decimals)), decimals);
}

const pointsText = (points: number): string => `${points.toFixed(2)}%`;

export const safeFraction = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

export const cellName = (cell: string): string => (cell === NO_CELL ? 'No cell' : `Cell ${cell}`);

export interface A1Entry {
  row: SourcedReport;
  hours: number;
  cell: string;
  month: string;
}

export interface MonthRow {
  cell: string;
  hours: number[];
  total: number;
}

export interface CellStats {
  cell: string;
  machines: number;
  available: number;
  bdHours: number;
  pmHours: number;
}

/** What the month tables read of A1's context: the plant's cells, their monthly rows and the whole-span totals. */
export interface MonthsContext {
  data: EngineData;
  asOf: string;
  annual: number;
  period: Period;
  months: PeriodMonth[];
  machines: MachineRow[];
  cells: string[];
  bdRows: MonthRow[];
  pmRows: MonthRow[];
  stats: CellStats[];
  bdPercent: number;
  pmPercent: number;
}

export function monthlyRows(
  cells: readonly string[],
  entries: readonly A1Entry[],
  months: readonly PeriodMonth[],
  want: (row: SourcedReport) => boolean,
): MonthRow[] {
  return cells.map((cell) => {
    const own = entries.filter((entry) => entry.cell === cell && want(entry.row));
    const hours = months.map((month) =>
      own.filter((entry) => entry.month === month.key).reduce((sum, entry) => sum + entry.hours, 0),
    );
    return { cell, hours, total: hours.reduce((sum, value) => sum + value, 0) };
  });
}

function monthlyAvailability(ctx: MonthsContext, cell: string | null): number[] {
  return ctx.months.map((month) => {
    const window: HoursWindow = {
      from: month.from > ctx.period.from ? month.from : ctx.period.from,
      to: month.to < ctx.period.to ? month.to : ctx.period.to,
      noRecords: ctx.period.noRecords,
      annualHours: ctx.annual,
    };
    return cell === null
      ? ctx.machines.reduce((sum, machine) => sum + availableHoursFor(machine, window), 0)
      : availableByCell(ctx.machines, ctx.data.moves, window, cell);
  });
}

function monthlyPoints(hours: readonly number[], available: readonly number[]): (number | null)[] {
  return hours.map((value, index) =>
    available[index]! > 0 ? (value / available[index]!) * 100 : null,
  );
}

function percentCells(
  points: readonly (number | null)[],
  months: readonly PeriodMonth[],
  year: string,
): string[] {
  const cells = points.map((value, index) =>
    months[index]!.state === 'no-records' ? NO_RECORDS : value === null ? DASH : pointsText(value),
  );
  const quarters = Array.from({ length: months.length / 3 }, (_, quarter) => {
    const average = quarterAverage(points.slice(quarter * 3, quarter * 3 + 3));
    return average === null ? DASH : pointsText(average);
  });
  return [...cells, ...quarters, year];
}

function percentRows(ctx: MonthsContext, cell: string | null): { bd: string[]; pm: string[] } {
  const index = cell === null ? -1 : ctx.cells.indexOf(cell);
  const available = monthlyAvailability(ctx, cell);
  const bdHours = cell === null ? monthlySeries(ctx.bdRows, ctx.months) : ctx.bdRows[index]!.hours;
  const pmHours = cell === null ? monthlySeries(ctx.pmRows, ctx.months) : ctx.pmRows[index]!.hours;
  const bdYear =
    cell === null
      ? ctx.bdPercent * 100
      : safeFraction(ctx.stats[index]!.bdHours, ctx.stats[index]!.available) * 100;
  const pmYear =
    cell === null
      ? ctx.pmPercent * 100
      : safeFraction(ctx.stats[index]!.pmHours, ctx.stats[index]!.available) * 100;
  return {
    bd: percentCells(monthlyPoints(bdHours, available), ctx.months, pointsText(bdYear)),
    pm: percentCells(monthlyPoints(pmHours, available), ctx.months, pointsText(pmYear)),
  };
}

export function monthlySeries(rows: readonly MonthRow[], months: readonly PeriodMonth[]): number[] {
  return months.map((_, index) => rows.reduce((sum, row) => sum + row.hours[index]!, 0));
}

/** The month column labels: `Jan` inside one year, `Jan 25` across years. */
export const monthLabels = (ctx: MonthsContext): string[] =>
  ctx.months.map((month) => monthLabel(month, ctx.period));

/** `Q1 Avg` inside one year, `Q1 25 Avg` across years: a quarter never loses its year. */
function quarterLabels(ctx: MonthsContext): string[] {
  return Array.from({ length: ctx.months.length / 3 }, (_, quarter) => {
    const year =
      ctx.months.length === 12
        ? ''
        : ` ${String(ctx.months[quarter * 3]!.year % 100).padStart(2, '0')}`;
    return `Q${(quarter % 4) + 1}${year} Avg`;
  });
}

/** A chart series with a null where the plant recorded nothing: a month with no records is not a zero. */
export function withGaps(
  series: readonly number[],
  months: readonly PeriodMonth[],
): (number | null)[] {
  return series.map((value, index) => (months[index]!.state === 'no-records' ? null : value));
}

export function percentTable(ctx: MonthsContext) {
  const rows: string[][] = [];
  for (const cell of ctx.cells) {
    const pair = percentRows(ctx, cell);
    rows.push([`${cellName(cell)}BD % / PM %`, ...pair.bd]);
    rows.push([...pair.pm]);
  }
  const plant = percentRows(ctx, null);
  rows.push([`PLANT TOTALBD % / PM %`, ...plant.bd]);
  rows.push([...plant.pm]);
  return {
    title: `Month-on-Month — BD % and PM % (${yearLabel(ctx.period)})`,
    header: ['Cell', ...monthLabels(ctx), ...quarterLabels(ctx), `Year ${yearLabel(ctx.period)}`],
    rows,
    rowCount: rows.length,
  };
}

function bdHoursCell(hours: number, yearTotal: number): string {
  if (!hours) return DASH;
  const share = yearTotal > 0 ? (hours / yearTotal) * 100 : 0;
  return `${inr(hours, 1)}${share.toFixed(1)}%`;
}

export function bdHoursTable(ctx: MonthsContext) {
  const yearTotal = monthlySeries(ctx.bdRows, ctx.months).reduce((sum, value) => sum + value, 0);
  return {
    title: `Month-on-Month — BD Hours by Cell (${yearLabel(ctx.period)})`,
    header: ['Cell', ...monthLabels(ctx), 'Total'],
    rows: ctx.bdRows.map((row) => [
      cellName(row.cell),
      ...row.hours.map((hours, index) =>
        ctx.months[index]!.state === 'no-records' ? NO_RECORDS : bdHoursCell(hours, yearTotal),
      ),
      inr(row.total, 1),
    ]),
    rowCount: ctx.bdRows.length,
  };
}

export function pmHoursTable(ctx: MonthsContext) {
  return {
    title: `Month-on-Month — PM Hours by Cell (${yearLabel(ctx.period)})`,
    header: ['Cell', ...monthLabels(ctx), 'Total'],
    rows: ctx.pmRows.map((row) => [
      cellName(row.cell),
      ...row.hours.map((hours, index) =>
        ctx.months[index]!.state === 'no-records' ? NO_RECORDS : hours ? inr(hours, 1) : DASH,
      ),
      inr(row.total, 1),
    ]),
    rowCount: ctx.pmRows.length,
  };
}
