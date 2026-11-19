import { calendarMonths, monthLabel, NO_RECORDS, spanOf, type Period } from './availability.js';
import { formatInr, roundValue } from './format.js';
import { cellKey } from './hours.js';
import { isProduction } from './machine-facts.js';
import { codeLabel } from './report-period.js';
import { failureEvents, shiftKey, type FailureEvent } from './standard-kpis.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The breakdown map (ticket 48, packet 48c): the failure set's exact hours ranked four ways — by machine, cell,
 * code and shift — with each row's running share and the row that passes half the lost time, and four heat grids
 * cutting those same rows by the month of the report's own date. This is the last figure of the shift-calendar
 * family, and it adds no new rule of its own: the failure set and the exact minutes are the ones the comparison and
 * the shift split already use. The cell is the machine's registered cell (the plan's own grouping: cell 2's 621.17 h
 * and cell 6's 593.57 h are the workbook's static cells), so a machine that moved does not split its hours.
 *
 * The map is the run's period (the as-of year to `asOf` when no span was named), so the month columns are the months
 * of it that have happened, each keyed with its year, and every row's cells add to that row's Pareto hours exactly
 * (the invariant the tests pin). A month the plant recorded nothing in prints `no records`, never a zero.
 * The machine grid prints the Pareto's own top fifteen and says how many it left out; the three smaller dimensions
 * print every row. A code prints the code as recorded with its `maint_code` label (R11), and an unlisted code prints
 * as recorded.
 */

const DASH = '—';
/** The annual report's Pareto size, so the two Paretos on the face read at one length. */
const PARETO_BARS = 15;

const DIMENSIONS = ['machine', 'cell', 'code', 'shift'] as const;
export type MapDimension = (typeof DIMENSIONS)[number];

const HEADER: Record<MapDimension, string> = {
  machine: 'Machine',
  cell: 'Cell',
  code: 'Code',
  shift: 'Shift',
};
const NOUN: Record<MapDimension, string> = {
  machine: 'Machines',
  cell: 'Cells',
  code: 'Codes',
  shift: 'Shifts',
};

/** One row of a Pareto: its key, its failures, its exact hours and the share of the dimension it has passed. */
export interface MapRow {
  key: string;
  breakdowns: number;
  hours: number;
  /** A percentage (10.067), never a fraction: the page prints it at two decimals. */
  cumulativePct: number;
}

/** One dimension ranked: its rows worst first and the point at which half the hours have been named. */
export interface DimensionMap {
  dimension: MapDimension;
  rows: MapRow[];
  /** The fewest worst rows carrying half the hours, and what the count is "of": the fleet or the keys. */
  fiftyPct: { count: number; of: number };
}

/** One row of a heat grid: the dimension's key and one unrounded hour per month. */
export interface HeatRow {
  key: string;
  values: number[];
}

/** One dimension's heat grid: the months that have happened, the printed rows and what is left out. */
export interface HeatGrid {
  dimension: MapDimension;
  months: string[];
  /** Per month, true when the plant recorded nothing in it: its cells are not zeroes. */
  gap: boolean[];
  rows: HeatRow[];
  /** Every key with a failure, printed or not (the machine grid's top fifteen leave the rest out). */
  total: number;
  omitted: number;
}

/** The figure's data: the four ranked dimensions, the four grids and the tickets behind every row. */
export interface BreakdownMap {
  map: DimensionMap[];
  grids: HeatGrid[];
  drillIds: string[];
}

interface Cell {
  breakdowns: number;
  hours: number;
  months: number[];
}

/** A recorded code or shift, or the platform's dash for a blank one. */
function shown(raw: string | null): string {
  const value = String(raw ?? '').trim();
  return value === '' ? DASH : value;
}

/** The failure events on the production fleet, inside the period. */
function mapEvents(data: EngineData, period: Period): FailureEvent[] {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return failureEvents(data).filter(
    (event) =>
      event.report.date >= period.from &&
      event.report.date <= period.to &&
      production.has(event.report.machineId),
  );
}

/** The key a failure files under in one dimension: the machine's code, its cell, its code or its shift. */
function keyOf(
  dimension: MapDimension,
  event: FailureEvent,
  machine: MachineRow | undefined,
): string {
  switch (dimension) {
    case 'machine':
      return machine?.code ?? event.report.machineId;
    case 'cell':
      return cellKey(machine?.cell);
    case 'code':
      return shown(event.report.maintCode);
    case 'shift':
      return shown(shiftKey(event.report));
  }
}

/** The fewest worst rows whose running hours pass half the dimension's total, and the total it is measured of. */
function fiftyOf(
  rows: readonly MapRow[],
  total: number,
  of: number,
): { count: number; of: number } {
  if (total <= 0) return { count: 0, of };
  let running = 0;
  let count = 0;
  for (const row of rows) {
    running += row.hours;
    count += 1;
    if (running >= total / 2) break;
  }
  return { count, of };
}

/** One dimension, ranked by hours, then by failures, then by key so two equal rows never swap between runs. */
function dimensionOf(
  dimension: MapDimension,
  cells: ReadonlyMap<string, Cell>,
  of: number,
): DimensionMap {
  const ranked = [...cells.entries()].sort(
    ([leftKey, left], [rightKey, right]) =>
      right.hours - left.hours ||
      right.breakdowns - left.breakdowns ||
      leftKey.localeCompare(rightKey),
  );
  const total = ranked.reduce((sum, [, cell]) => sum + cell.hours, 0);
  let running = 0;
  const rows = ranked.map(([key, cell]): MapRow => {
    running += cell.hours;
    return {
      key,
      breakdowns: cell.breakdowns,
      hours: cell.hours,
      cumulativePct: total > 0 ? (running / total) * 100 : 0,
    };
  });
  return { dimension, rows, fiftyPct: fiftyOf(rows, total, of) };
}

/**
 * The four ranked dimensions and their heat grids over the period's happened months. A plant with no failure
 * returns empty dimensions and grids; the figure then prints nothing rather than a page of zeroes.
 */
export function breakdownMap(data: EngineData, asOf: string): BreakdownMap {
  const period = spanOf(data, asOf);
  const happened = calendarMonths(period).filter((month) => month.state !== 'outside');
  const months = happened.map((month) => monthLabel(month, period));
  const monthIndex = new Map(happened.map((month, index) => [month.key, index]));
  const production = data.machines.filter(isProduction);
  const byId = new Map(data.machines.map((machine) => [machine.id, machine]));
  const events = mapEvents(data, period);
  const cells = new Map<MapDimension, Map<string, Cell>>(
    DIMENSIONS.map((dimension) => [dimension, new Map<string, Cell>()]),
  );
  for (const event of events) {
    const machine = byId.get(event.report.machineId);
    const month = monthIndex.get(event.report.date.slice(0, 7));
    for (const dimension of DIMENSIONS) {
      const key = keyOf(dimension, event, machine);
      const group = cells.get(dimension)!;
      const cell = group.get(key) ?? { breakdowns: 0, hours: 0, months: months.map(() => 0) };
      cell.breakdowns += 1;
      cell.hours += event.hours;
      if (month !== undefined) cell.months[month] = (cell.months[month] ?? 0) + event.hours;
      group.set(key, cell);
    }
  }

  const map = DIMENSIONS.map((dimension) =>
    dimensionOf(
      dimension,
      cells.get(dimension)!,
      dimension === 'machine' ? production.length : cells.get(dimension)!.size,
    ),
  );
  const grids = DIMENSIONS.map((dimension): HeatGrid => {
    const ranked = map.find((entry) => entry.dimension === dimension)!.rows;
    const printed = dimension === 'machine' ? ranked.slice(0, PARETO_BARS) : ranked;
    const group = cells.get(dimension)!;
    return {
      dimension,
      months: [...months],
      gap: happened.map((month) => month.state === 'no-records'),
      rows: printed.map((row) => ({ key: row.key, values: [...group.get(row.key)!.months] })),
      total: ranked.length,
      omitted: ranked.length - printed.length,
    };
  });
  return { map, grids, drillIds: events.map((event) => event.ticket.id) };
}

interface PageTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  /** The face draws this table as a heat matrix (R14): the month cells, never the total. */
  heat: true;
}

interface Chart {
  id: string;
  type: string;
  axes: { x: string; y: string; y1: string };
  tickLabels: { x: string[]; y: string[]; y1: string[] };
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
}

/** The page's label for a key: the code axis adds the maint_code description (R11), the others print the key. */
function labelOf(dimension: MapDimension, key: string, data: EngineData): string {
  return dimension === 'code' ? codeLabel(key, data.lists) : key;
}

/** One dimension's heat table: the months, the row's total and the share it has passed. */
function heatTable(data: EngineData, entry: DimensionMap, grid: HeatGrid): PageTable {
  const rows = entry.rows
    .slice(0, grid.rows.length)
    .map((row, index) => [
      labelOf(entry.dimension, row.key, data),
      ...grid.rows[index]!.values.map((value, month) =>
        grid.gap[month] ? NO_RECORDS : value === 0 ? DASH : formatInr(value, 2),
      ),
      formatInr(row.hours, 2),
      formatInr(row.cumulativePct, 2),
    ]);
  const title =
    entry.dimension === 'machine' && grid.omitted > 0
      ? `By machine — BD hours by month (top ${grid.rows.length} of ${grid.total} machines, ${grid.omitted} left out)`
      : `By ${entry.dimension} — BD hours by month`;
  return {
    title,
    header: [HEADER[entry.dimension], ...grid.months, 'Total', 'Cumulative %'],
    rows,
    rowCount: rows.length,
    heat: true,
  };
}

/** One dimension's Pareto: the printed rows' hours as bars and their running share as the line. */
function paretoChart(data: EngineData, entry: DimensionMap, grid: HeatGrid): Chart {
  const byKey = new Map(entry.rows.map((row) => [row.key, row]));
  const printed = grid.rows.map((row) => byKey.get(row.key)!);
  return {
    id: `ch-sk-${entry.dimension}`,
    type: 'mixed',
    axes: { x: '', y: '', y1: '' },
    tickLabels: { x: [], y: [], y1: [] },
    labels: printed.map((row) => labelOf(entry.dimension, row.key, data)),
    datasets: [
      { label: 'BD hours', data: printed.map((row) => roundValue(row.hours, 2)) },
      { label: 'Cumulative %', data: printed.map((row) => roundValue(row.cumulativePct, 2)) },
    ],
  };
}

/** The four half-the-hours facts, each naming the dimension in the reader's own words. */
function mapKpis(map: readonly DimensionMap[]) {
  return map.map((entry) => ({
    label: `${NOUN[entry.dimension]} for half the hours`,
    value: `${formatInr(entry.fiftyPct.count, 0)} of ${formatInr(entry.fiftyPct.of, 0)}`,
    sub: 'the worst rows carry half the lost hours',
  }));
}

/**
 * The breakdown-map figure: the four Paretos and their heat grids on one page. With no failure there is nothing to
 * rank, so the figure is null like the comparison; the map needs no shift window, because it reads recorded hours
 * and never divides by a denominator.
 */
export const shiftKpisBreakdownMapFigure: Computer = ({ data, asOf }) => {
  const computed = breakdownMap(data, asOf);
  if (computed.drillIds.length === 0) return { value: null, drillIds: [] };
  const map = computed.map as DimensionMap[];
  const value = {
    screen: 'shift-kpis',
    asOf,
    map,
    pages: [
      {
        page: 'shift-kpis',
        title: 'Breakdown map',
        kpis: mapKpis(map),
        tables: map.map((entry, index) => heatTable(data, entry, computed.grids[index]!)),
        charts: map.map((entry, index) => paretoChart(data, entry, computed.grids[index]!)),
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: computed.drillIds,
  };
};
