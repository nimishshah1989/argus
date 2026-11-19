import { calendarMonths, spanOf, type Period, type PeriodMonth } from './availability.js';
import {
  availableByCell,
  availableHoursFor,
  cellAt,
  cellKey,
  NO_CELL,
  periodMonthWindow,
  type HoursWindow,
} from './hours.js';
import { isProduction, machineAge } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { EngineData, MachineRow, MoveRow } from './types.js';

/**
 * A3's analysis model (ticket 40, packet 40d): the production breakdown rows and the four MTBF bases. MTTR is the
 * recorded breakdown hours over the breakdown count; MTBF is (available hours − breakdown hours) over the count.
 * The days-so-far window serves the summary groups and a Total; each month's own window serves that month's cell;
 * a quarter is the average of its unrounded monthly values. A group with no breakdowns prints MTTR 0.00 and MTBF
 * its available hours, while an empty month is null so the page can print the dash.
 */

const BANDS: ReadonlyArray<{ label: string; low: number; high: number }> = [
  { label: '0-5 yrs', low: 0, high: 5 },
  { label: '5-10 yrs', low: 5, high: 10 },
  { label: '10-15 yrs', low: 10, high: 15 },
  { label: '15-20 yrs', low: 15, high: 20 },
  { label: '20+ yrs', low: 20, high: Number.POSITIVE_INFINITY },
];

export interface A3Entry {
  row: SourcedReport;
  machine: MachineRow;
  category: string;
  cell: string;
  band: string | null;
  hours: number;
  /** The month the report falls in, `YYYY-MM`: a month never stands without its year. */
  month: string;
}

export interface Group {
  label: string;
  machines: number;
  count: number;
  hours: number;
  available: number;
}

export interface MomGroup extends Group {
  monthly: (month: PeriodMonth) => { count: number; hours: number; available: number };
}

export interface MomRow {
  label: string;
  count: number;
  mttr: Array<number | null>;
  mtbf: Array<number | null>;
  totalMttr: number | null;
  totalMtbf: number | null;
}

export interface A3Context {
  data: EngineData;
  asOf: string;
  annual: number;
  period: Period;
  months: PeriodMonth[];
  machines: MachineRow[];
  entries: A3Entry[];
  categories: string[];
  cells: string[];
  window: HoursWindow;
  categoryGroups: Group[];
  cellGroups: Group[];
  ageGroups: Group[];
  plant: Group;
}

export const cellName = (cell: string): string => (cell === NO_CELL ? 'No cell' : `Cell ${cell}`);

export const mttrOf = (group: Group): number => (group.count > 0 ? group.hours / group.count : 0);

export const mtbfOf = (group: Group): number =>
  group.count > 0 ? (group.available - group.hours) / group.count : group.available;

export const sumHours = (entries: readonly A3Entry[]): number =>
  entries.reduce((sum, entry) => sum + entry.hours, 0);

function bandOf(machine: MachineRow, asOf: string): string | null {
  const age = machineAge(machine, asOf);
  if (age === null) return null;
  const band = BANDS.find((candidate) => age >= candidate.low && age < candidate.high);
  return band?.label ?? null;
}

/** The production breakdown rows: PM excluded, NO DT counted at zero hours, with their cell and age band. */
function breakdownEntries(
  data: EngineData,
  machines: readonly MachineRow[],
  asOf: string,
  period: Period,
): A3Entry[] {
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  const entries: A3Entry[] = [];
  for (const row of sourcedReports(data)) {
    if (!isHistory(row) || isPm(row)) continue;
    if (row.report.date < period.from || row.report.date > period.to) continue;
    const machine = byId.get(row.report.machineId);
    if (machine === undefined) continue;
    entries.push({
      row,
      machine,
      category: machine.category?.trim() ?? '',
      cell: cellAt(machine, data.moves, row.report.date),
      band: bandOf(machine, asOf),
      hours: effectiveHours(row.report),
      month: row.report.date.slice(0, 7),
    });
  }
  return entries;
}

function categoryOrder(machines: readonly MachineRow[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const machine of machines) {
    const category = machine.category?.trim();
    if (category && !seen.has(category)) {
      seen.add(category);
      categories.push(category);
    }
  }
  return categories;
}

function cellOrder(machines: readonly MachineRow[], moves: readonly MoveRow[]): string[] {
  const ids = new Set(machines.map((machine) => machine.id));
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

function sumAvailable(machines: readonly MachineRow[], window: HoursWindow): number {
  return machines.reduce((sum, machine) => sum + availableHoursFor(machine, window), 0);
}

function groupFor(
  label: string,
  machines: readonly MachineRow[],
  entries: readonly A3Entry[],
  available: number,
): Group {
  return {
    label,
    machines: machines.length,
    count: entries.length,
    hours: sumHours(entries),
    available,
  };
}

function categoryGroups(
  categories: readonly string[],
  machines: readonly MachineRow[],
  entries: readonly A3Entry[],
  window: HoursWindow,
): Group[] {
  return categories.map((category) => {
    const own = machines.filter((machine) => machine.category?.trim() === category);
    const rows = entries.filter((entry) => entry.category === category);
    return groupFor(category, own, rows, sumAvailable(own, window));
  });
}

function cellGroups(input: {
  cells: readonly string[];
  machines: readonly MachineRow[];
  moves: readonly MoveRow[];
  entries: readonly A3Entry[];
  window: HoursWindow;
}): Group[] {
  return input.cells.map((cell) => {
    const own = input.machines.filter((machine) => cellKey(machine.cell) === cell);
    const rows = input.entries.filter((entry) => entry.cell === cell);
    const available = availableByCell(input.machines, input.moves, input.window, cell);
    return groupFor(cell, own, rows, available);
  });
}

function ageBands(
  machines: readonly MachineRow[],
  entries: readonly A3Entry[],
  window: HoursWindow,
  asOf: string,
): Group[] {
  return BANDS.map((band) => {
    const own = machines.filter((machine) => bandOf(machine, asOf) === band.label);
    const rows = entries.filter((entry) => entry.band === band.label);
    return groupFor(band.label, own, rows, sumAvailable(own, window));
  });
}

export function buildContext(data: EngineData, asOf: string, annual: number): A3Context {
  const machines = data.machines.filter(isProduction);
  const period = spanOf(data, asOf);
  const entries = breakdownEntries(data, machines, asOf, period);
  const window: HoursWindow = { ...period, annualHours: annual };
  const categories = categoryOrder(machines);
  const cells = cellOrder(machines, data.moves);
  return {
    data,
    asOf,
    annual,
    period,
    months: calendarMonths(period),
    machines,
    entries,
    categories,
    cells,
    window,
    categoryGroups: categoryGroups(categories, machines, entries, window),
    cellGroups: cellGroups({ cells, machines, moves: data.moves, entries, window }),
    ageGroups: ageBands(machines, entries, window, asOf),
    plant: groupFor('PLANT TOTAL', machines, entries, sumAvailable(machines, window)),
  };
}

const windowFor = (ctx: A3Context, month: PeriodMonth): HoursWindow => ({
  ...periodMonthWindow(month, ctx.period),
  annualHours: ctx.annual,
});

function momGroup(
  label: string,
  group: Group,
  entries: readonly A3Entry[],
  monthlyAvailable: (month: PeriodMonth) => number,
): MomGroup {
  return {
    ...group,
    label,
    count: entries.length,
    hours: sumHours(entries),
    monthly: (month) => {
      const own = entries.filter((entry) => entry.month === month.key);
      return { count: own.length, hours: sumHours(own), available: monthlyAvailable(month) };
    },
  };
}

export function cellMomGroups(ctx: A3Context): MomGroup[] {
  return ctx.cells.map((cell) => {
    const group = ctx.cellGroups.find((candidate) => candidate.label === cell)!;
    const rows = ctx.entries.filter((entry) => entry.cell === cell);
    return momGroup(cellName(cell), group, rows, (month) =>
      availableByCell(ctx.machines, ctx.data.moves, windowFor(ctx, month), cell),
    );
  });
}

export function ageMomGroups(ctx: A3Context): MomGroup[] {
  return BANDS.map((band) => {
    const own = ctx.machines.filter((machine) => bandOf(machine, ctx.asOf) === band.label);
    const group = ctx.ageGroups.find((candidate) => candidate.label === band.label)!;
    const rows = ctx.entries.filter((entry) => entry.band === band.label);
    return momGroup(band.label, group, rows, (month) => sumAvailable(own, windowFor(ctx, month)));
  });
}

export function plantMomGroup(ctx: A3Context): MomGroup {
  return momGroup('PLANT TOTAL', ctx.plant, ctx.entries, (month) =>
    sumAvailable(ctx.machines, windowFor(ctx, month)),
  );
}

function monthlyValues(
  group: MomGroup,
  months: readonly PeriodMonth[],
): {
  mttr: Array<number | null>;
  mtbf: Array<number | null>;
} {
  const mttr: Array<number | null> = [];
  const mtbf: Array<number | null> = [];
  for (const month of months) {
    const values = group.monthly(month);
    if (values.count === 0) {
      mttr.push(null);
      mtbf.push(null);
    } else {
      mttr.push(values.hours / values.count);
      mtbf.push((values.available - values.hours) / values.count);
    }
  }
  return { mttr, mtbf };
}

export function momRow(group: MomGroup, months: readonly PeriodMonth[]): MomRow {
  const values = monthlyValues(group, months);
  return {
    label: group.label,
    count: group.count,
    mttr: values.mttr,
    mtbf: values.mtbf,
    totalMttr: group.count > 0 ? group.hours / group.count : null,
    totalMtbf: group.count > 0 ? (group.available - group.hours) / group.count : null,
  };
}
