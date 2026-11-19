import { availabilityWindow } from './availability.js';
import { formatInr } from './format.js';
import {
  availableByCell,
  availableHoursFor,
  cellAt,
  cellKey,
  NO_CELL,
  type HoursWindow,
} from './hours.js';
import {
  cellName,
  inr,
  MONTHS,
  monthlyRows,
  monthlySeries,
  bdHoursTable,
  percentTable,
  pmHoursTable,
  safeFraction,
  type A1Entry,
  type CellStats,
  type MonthsContext,
} from './a1-months.js';
import { isProduction } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow, MoveRow } from './types.js';

/**
 * A1, BD % and the PM split (ticket 40, packet 40b): the platform's own page, whole — the shared seam's windows
 * and effective cells, and its print quirks as data: the empty second label, concatenated hour+share cells, the
 * dash, PLANT TOTAL prefixes and a Total that is the recomputed aggregate.
 */

function inrUpTo2(value: number): string {
  const text = value.toFixed(2).replace(/\.?0+$/, '');
  const decimals = text.includes('.') ? text.split('.')[1]!.length : 0;
  return formatInr(Number(text), decimals);
}

const fractionText = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

interface A1Context extends MonthsContext {
  entries: A1Entry[];
  totalAvailable: number;
  bdHours: number;
  pmHours: number;
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
  const machines = data.machines.filter(isProduction);
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
