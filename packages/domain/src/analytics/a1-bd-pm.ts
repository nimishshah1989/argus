import { availabilityWindow } from './availability.js';
import { formatInr } from './format.js';
import {
  availableByCell,
  availableHoursFor,
  cellAt,
  cellKey,
  monthlyWindow,
  NO_CELL,
  quarterAverage,
  type HoursWindow,
} from './hours.js';
import { effectiveHours, isHistory, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow, MoveRow } from './types.js';

/**
 * A1, BD % and the PM split (ticket 40, packet 40b): the platform's own page, whole — the shared seam's windows
 * and effective cells, and its print quirks as data: the empty second label, concatenated hour+share cells, the
 * dash, PLANT TOTAL prefixes and a Total that is the recomputed aggregate.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASH = '—';

function productionMachines(data: EngineData): MachineRow[] {
  return data.machines.filter(
    (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
  );
}

function inrUpTo2(value: number): string {
  const text = value.toFixed(2).replace(/\.?0+$/, '');
  const decimals = text.includes('.') ? text.split('.')[1]!.length : 0;
  return formatInr(Number(text), decimals);
}

function inr(value: number, decimals: number): string {
  return formatInr(Number(value.toFixed(decimals)), decimals);
}

const fractionText = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

const pointsText = (points: number): string => `${points.toFixed(2)}%`;

const safeFraction = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

const cellName = (cell: string): string => (cell === NO_CELL ? 'No cell' : `Cell ${cell}`);

interface A1Entry {
  row: SourcedReport;
  hours: number;
  cell: string;
  month: number;
}

interface MonthRow {
  cell: string;
  hours: number[];
  total: number;
}

interface CellStats {
  cell: string;
  machines: number;
  available: number;
  bdHours: number;
  pmHours: number;
}

interface A1Context {
  data: EngineData;
  asOf: string;
  annual: number;
  machines: MachineRow[];
  cells: string[];
  entries: A1Entry[];
  bdRows: MonthRow[];
  pmRows: MonthRow[];
  stats: CellStats[];
  totalAvailable: number;
  bdHours: number;
  pmHours: number;
  bdPercent: number;
  pmPercent: number;
}

function analysisEntries(data: EngineData, machines: readonly MachineRow[]): A1Entry[] {
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  return sourcedReports(data)
    .filter((row) => isHistory(row) && byId.has(row.report.machineId))
    .map((row) => ({
      row,
      hours: effectiveHours(row.report),
      cell: cellAt(byId.get(row.report.machineId)!, data.moves, row.report.date),
      month: Number(row.report.date.slice(5, 7)),
    }));
}

function plantCells(
  machines: readonly MachineRow[],
  moves: readonly MoveRow[],
  ids: ReadonlySet<string>,
): string[] {
  const cells = new Set<string>();
  for (const machine of machines) cells.add(cellKey(machine.cell));
  for (const move of moves) {
    if (!ids.has(move.machineId)) continue;
    cells.add(cellKey(move.fromCell));
    cells.add(cellKey(move.toCell));
  }
  return [...cells].sort((left, right) =>
    left === NO_CELL
      ? 1
      : right === NO_CELL
        ? -1
        : Number(left) - Number(right) || left.localeCompare(right),
  );
}

function monthlyRows(
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

function cellStats(input: {
  cells: readonly string[];
  machines: readonly MachineRow[];
  moves: readonly MoveRow[];
  window: HoursWindow;
  entries: readonly A1Entry[];
}): CellStats[] {
  return input.cells.map((cell) => {
    const own = input.entries.filter((entry) => entry.cell === cell);
    return {
      cell,
      machines: input.machines.filter((machine) => cellKey(machine.cell) === cell).length,
      available: availableByCell(input.machines, input.moves, input.window, cell),
      bdHours: own.filter((entry) => !isPm(entry.row)).reduce((sum, entry) => sum + entry.hours, 0),
      pmHours: own.filter((entry) => isPm(entry.row)).reduce((sum, entry) => sum + entry.hours, 0),
    };
  });
}

function buildContext(data: EngineData, asOf: string, annual: number): A1Context {
  const machines = productionMachines(data);
  const ids = new Set(machines.map((machine) => machine.id));
  const entries = analysisEntries(data, machines);
  const cells = plantCells(machines, data.moves, ids);
  const window: HoursWindow = { ...availabilityWindow(asOf, asOf), annualHours: annual };
  const bdRows = monthlyRows(cells, entries, (row) => !isPm(row));
  const pmRows = monthlyRows(cells, entries, (row) => isPm(row));
  const stats = cellStats({ cells, machines, moves: data.moves, window, entries });
  const totalAvailable = machines.reduce(
    (sum, machine) => sum + availableHoursFor(machine, window),
    0,
  );
  const bdHours = entries
    .filter((entry) => !isPm(entry.row))
    .reduce((sum, entry) => sum + entry.hours, 0);
  const pmHours = entries
    .filter((entry) => isPm(entry.row))
    .reduce((sum, entry) => sum + entry.hours, 0);
  return {
    data,
    asOf,
    annual,
    machines,
    cells,
    entries,
    bdRows,
    pmRows,
    stats,
    totalAvailable,
    bdHours,
    pmHours,
    bdPercent: safeFraction(bdHours, totalAvailable),
    pmPercent: safeFraction(pmHours, totalAvailable),
  };
}

function a1Kpis(ctx: A1Context): Array<{ label: string; value: string; sub: string }> {
  const count = ctx.machines.length;
  const [, month, day] = ctx.asOf.split('-').map(Number);
  return [
    {
      label: 'Avg Available Hrs / Machine',
      value: inrUpTo2(count > 0 ? ctx.totalAvailable / count : 0),
      sub: `hours to ${day} ${MONTHS[month! - 1]} · annual ${inrUpTo2(ctx.annual)} from Settings`,
    },
    { label: 'Total Machines', value: String(count), sub: 'machines counted in production data' },
    { label: 'Total Available Hrs', value: inrUpTo2(ctx.totalAvailable), sub: 'whole plant' },
    {
      label: 'Actual Breakdown',
      value: `${inr(ctx.bdHours, 1)} hrs`,
      sub: `${fractionText(ctx.bdPercent)} of available`,
    },
    {
      label: 'PM Downtime',
      value: `${inr(ctx.pmHours, 1)} hrs`,
      sub: `${fractionText(ctx.pmPercent)} of available`,
    },
    {
      label: 'Fleet Availability',
      value: fractionText(1 - ctx.bdPercent - ctx.pmPercent),
      sub: 'BD + PM excluded',
    },
  ];
}

function byCellTable(ctx: A1Context) {
  return {
    title: 'By Cell — Detail',
    header: ['Cell', 'Machines', 'Available Hrs', 'BD Hrs', 'BD %', 'PM Hrs', 'PM %', 'Total %'],
    rows: ctx.stats.map((stat) => [
      cellName(stat.cell),
      String(stat.machines),
      inrUpTo2(stat.available),
      inr(stat.bdHours, 2),
      fractionText(safeFraction(stat.bdHours, stat.available)),
      inr(stat.pmHours, 2),
      fractionText(safeFraction(stat.pmHours, stat.available)),
      fractionText(safeFraction(stat.bdHours + stat.pmHours, stat.available)),
    ]),
    rowCount: ctx.stats.length,
  };
}

function monthlyAvailability(ctx: A1Context, cell: string | null): number[] {
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

function percentRows(ctx: A1Context, cell: string | null): { bd: string[]; pm: string[] } {
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

function monthlySeries(rows: readonly MonthRow[]): number[] {
  return MONTHS.map((_, index) => rows.reduce((sum, row) => sum + row.hours[index]!, 0));
}

function percentTable(ctx: A1Context) {
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

function bdHoursTable(ctx: A1Context) {
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

function pmHoursTable(ctx: A1Context) {
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

function charts(ctx: A1Context): Array<Record<string, unknown>> {
  const plot = (part: (stat: CellStats) => number) =>
    ctx.stats.map((stat) => Math.round(safeFraction(part(stat), stat.available) * 10000) / 100);
  return [
    {
      id: 'ch-a1-cell',
      type: 'bar',
      axes: { x: '', y: '' },
      tickLabels: { x: [], y: [] },
      labels: ctx.stats.map((stat) => cellName(stat.cell)),
      datasets: [
        { label: 'BD %', data: plot((stat) => stat.bdHours) },
        { label: 'PM %', data: plot((stat) => stat.pmHours) },
      ],
    },
    {
      id: 'ch-a1-trend',
      type: 'line',
      axes: { x: '', y: '' },
      tickLabels: { x: [], y: [] },
      labels: MONTHS,
      datasets: [
        { label: 'BD Hrs', data: monthlySeries(ctx.bdRows) },
        { label: 'PM Hrs', data: monthlySeries(ctx.pmRows) },
      ],
    },
  ];
}

/**
 * The A1 figure: the key's page shape, the six KPIs, four tables and two charts. An empty production fleet or no
 * numerator rows has no page to print, so the figure is null rather than a fabricated zero. The drill names the BD
 * and PM tickets the numerator read, production-filtered, in the order the rows were read.
 */
export const a1BdPmFigure: Computer = ({ data, asOf, profile }) => {
  const annual = profile.prodHrsPerDay * profile.workDaysPerYear;
  const ctx = buildContext(data, asOf, annual);
  if (ctx.machines.length === 0 || ctx.entries.length === 0) {
    return { value: null, drillIds: [] };
  }
  const value = {
    screen: 'a1-bd-pm',
    asOf,
    pages: [
      {
        page: 'a1',
        title: 'BD % & PM Split',
        kpis: a1Kpis(ctx),
        tables: [byCellTable(ctx), percentTable(ctx), bdHoursTable(ctx), pmHoursTable(ctx)],
        charts: charts(ctx),
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: ctx.entries.map((entry) => entry.row.ticket.id),
  };
};
