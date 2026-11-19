import { formatInr } from './format.js';
import {
  availableByCell,
  availableHoursFor,
  monthlyWindow,
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
  month: number;
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
  want: (row: SourcedReport) => boolean,
): MonthRow[] {
  return cells.map((cell) => {
    const own = entries.filter((entry) => entry.cell === cell && want(entry.row));
    const hours = MONTHS.map((_, index) =>
      own.filter((entry) => entry.month === index + 1).reduce((sum, entry) => sum + entry.hours, 0),
    );
    return { cell, hours, total: hours.reduce((sum, value) => sum + value, 0) };
  });
}

function monthlyAvailability(ctx: MonthsContext, cell: string | null): number[] {
  return MONTHS.map((_, index) => {
    const window: HoursWindow = { ...monthlyWindow(ctx.asOf, index + 1), annualHours: ctx.annual };
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

function percentCells(points: readonly (number | null)[], year: string): string[] {
  const months = points.map((value) => (value === null ? DASH : pointsText(value)));
  const quarters = [0, 1, 2, 3].map((quarter) => {
    const average = quarterAverage(points.slice(quarter * 3, quarter * 3 + 3));
    return average === null ? DASH : pointsText(average);
  });
  return [...months, ...quarters, year];
}

function percentRows(ctx: MonthsContext, cell: string | null): { bd: string[]; pm: string[] } {
  const index = cell === null ? -1 : ctx.cells.indexOf(cell);
  const available = monthlyAvailability(ctx, cell);
  const bdHours = cell === null ? monthlySeries(ctx.bdRows) : ctx.bdRows[index]!.hours;
  const pmHours = cell === null ? monthlySeries(ctx.pmRows) : ctx.pmRows[index]!.hours;
  const bdYear =
    cell === null
      ? ctx.bdPercent * 100
      : safeFraction(ctx.stats[index]!.bdHours, ctx.stats[index]!.available) * 100;
  const pmYear =
    cell === null
      ? ctx.pmPercent * 100
      : safeFraction(ctx.stats[index]!.pmHours, ctx.stats[index]!.available) * 100;
  return {
    bd: percentCells(monthlyPoints(bdHours, available), pointsText(bdYear)),
    pm: percentCells(monthlyPoints(pmHours, available), pointsText(pmYear)),
  };
}

export function monthlySeries(rows: readonly MonthRow[]): number[] {
  return MONTHS.map((_, index) => rows.reduce((sum, row) => sum + row.hours[index]!, 0));
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
    title: `Month-on-Month — BD % and PM % (${ctx.asOf.slice(0, 4)})`,
    header: [
      'Cell',
      ...MONTHS,
      'Q1 Avg',
      'Q2 Avg',
      'Q3 Avg',
      'Q4 Avg',
      `Year ${ctx.asOf.slice(0, 4)}`,
    ],
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
  const yearTotal = monthlySeries(ctx.bdRows).reduce((sum, value) => sum + value, 0);
  return {
    title: `Month-on-Month — BD Hours by Cell (${ctx.asOf.slice(0, 4)})`,
    header: ['Cell', ...MONTHS, 'Total'],
    rows: ctx.bdRows.map((row) => [
      cellName(row.cell),
      ...row.hours.map((hours) => bdHoursCell(hours, yearTotal)),
      inr(row.total, 1),
    ]),
    rowCount: ctx.bdRows.length,
  };
}

export function pmHoursTable(ctx: MonthsContext) {
  return {
    title: `Month-on-Month — PM Hours by Cell (${ctx.asOf.slice(0, 4)})`,
    header: ['Cell', ...MONTHS, 'Total'],
    rows: ctx.pmRows.map((row) => [
      cellName(row.cell),
      ...row.hours.map((hours) => (hours ? inr(hours, 1) : DASH)),
      inr(row.total, 1),
    ]),
    rowCount: ctx.pmRows.length,
  };
}
