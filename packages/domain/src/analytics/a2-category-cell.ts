import { formatInr, normalizeLabel } from './format.js';
import { cellAt, cellKey, NO_CELL } from './hours.js';
import { isProduction } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow, MoveRow } from './types.js';

/**
 * A2, the category and cell analysis (ticket 40, packet 40c): the platform's own page, whole — the 14 category rows,
 * the 9 cell rows, one machine-level table per category and the eight charts. Breakdown hours are the shared seam's
 * recorded hours and production filter; a breakdown belongs to the cell the machine was in on its date (cellAt), while
 * a machine-level row prints the machine's current cell. Table labels are the key's normalised text; chart labels keep
 * the raw category, double space and all.
 */

/** The key's own table headers: the summary tables share theirs, the machine tables are narrower. */
const SUMMARY_HEADER = [
  'Category',
  'Machines',
  '# Breakdowns',
  'BD Hours',
  '% of Total BD',
  'Avg Hrs/Machine',
  'Avg Hrs/Breakdown',
];
const MACHINE_HEADER = ['Machine ID', 'Cell', '# Breakdowns', 'BD Hours', '% of Total BD'];

const fractionText = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

const safeFraction = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

/** The key's two-decimal chart value, the platform's own `Math.round(v*100)/100`. */
const chartValue = (value: number): number => Math.round(value * 100) / 100;

const cellName = (cell: string): string => (cell === NO_CELL ? 'No cell' : `Cell ${cell}`);

interface A2Entry {
  row: SourcedReport;
  machine: MachineRow;
  category: string;
  cell: string;
  hours: number;
}

interface A2Group {
  label: string;
  machines: number;
  count: number;
  hours: number;
}

interface A2Context {
  machines: MachineRow[];
  entries: A2Entry[];
  categories: string[];
  cells: string[];
  totalHours: number;
}

/** The production breakdown rows, each with its recorded hours, its category and the cell it was in that day. */
function analysisEntries(data: EngineData, machines: readonly MachineRow[]): A2Entry[] {
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  const entries: A2Entry[] = [];
  for (const row of sourcedReports(data)) {
    if (!isHistory(row) || isPm(row)) continue;
    const machine = byId.get(row.report.machineId);
    const category = machine?.category?.trim();
    if (machine === undefined || category === undefined || category === '') continue;
    entries.push({
      row,
      machine,
      category,
      cell: cellAt(machine, data.moves, row.report.date),
      hours: effectiveHours(row.report),
    });
  }
  return entries;
}

/** The categories in the order the plant lists its machines; the Robot's list is already out of production. */
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

/** The cells the production fleet and its moves reach: numeric, the platform's "No cell" bucket last. */
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

function buildContext(data: EngineData): A2Context {
  const machines = data.machines.filter(isProduction);
  const entries = analysisEntries(data, machines);
  return {
    machines,
    entries,
    categories: categoryOrder(machines),
    cells: cellOrder(machines, data.moves),
    totalHours: entries.reduce((sum, entry) => sum + entry.hours, 0),
  };
}

/** One group per label: its machines, its breakdown rows and their recorded hours. */
function grouped(
  labels: readonly string[],
  machinesFor: (label: string) => number,
  entriesFor: (label: string) => readonly A2Entry[],
): A2Group[] {
  return labels.map((label) => {
    const own = entriesFor(label);
    return {
      label,
      machines: machinesFor(label),
      count: own.length,
      hours: own.reduce((sum, entry) => sum + entry.hours, 0),
    };
  });
}

function categoryGroups(ctx: A2Context): A2Group[] {
  return grouped(
    ctx.categories,
    (category) => ctx.machines.filter((machine) => machine.category?.trim() === category).length,
    (category) => ctx.entries.filter((entry) => entry.category === category),
  );
}

function cellGroups(ctx: A2Context): A2Group[] {
  return grouped(
    ctx.cells,
    (cell) => ctx.machines.filter((machine) => cellKey(machine.cell) === cell).length,
    (cell) => ctx.entries.filter((entry) => entry.cell === cell),
  );
}

/** A summary table's printed rows, the key's own decimal and grouping rules. */
function summaryTable(
  spec: { title: string; firstHeader: string },
  label: (group: A2Group) => string,
  groups: readonly A2Group[],
  totalHours: number,
) {
  const rows = groups.map((group) => [
    label(group),
    String(group.machines),
    String(group.count),
    formatInr(group.hours, 2),
    fractionText(safeFraction(group.hours, totalHours)),
    formatInr(safeFraction(group.hours, group.machines), 2),
    formatInr(safeFraction(group.hours, group.count), 2),
  ]);
  return {
    title: spec.title,
    header: [spec.firstHeader, ...SUMMARY_HEADER.slice(1)],
    rows,
    rowCount: rows.length,
  };
}

/** One category's machines, biggest hours first; a tie keeps the plant's machine order. */
function machineTable(ctx: A2Context, category: string, totalHours: number) {
  const machines = ctx.machines.filter((machine) => machine.category?.trim() === category);
  const rows = machines
    .map((machine) => {
      const own = ctx.entries.filter((entry) => entry.machine.id === machine.id);
      return {
        id: machine.id,
        cell: cellKey(machine.cell),
        count: own.length,
        hours: own.reduce((sum, entry) => sum + entry.hours, 0),
      };
    })
    .sort((left, right) => right.hours - left.hours)
    .map((machine) => [
      machine.id,
      machine.cell,
      String(machine.count),
      formatInr(machine.hours, 2),
      fractionText(safeFraction(machine.hours, totalHours)),
    ]);
  return { title: 'Machine-Level Detail', header: MACHINE_HEADER, rows, rowCount: rows.length };
}

function barChart(id: string, labels: readonly string[], data: readonly number[], dataset: string) {
  return {
    id,
    type: 'bar',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels,
    datasets: [{ label: dataset, data }],
  };
}

function charts(categories: readonly A2Group[], cells: readonly A2Group[]) {
  const categoryLabels = categories.map((group) => group.label);
  const cellLabels = cells.map((group) => cellName(group.label));
  const hoursPerMachine = (group: A2Group) => safeFraction(group.hours, group.machines);
  const countPerMachine = (group: A2Group) => safeFraction(group.count, group.machines);
  return [
    barChart(
      'ch-a2-cathrs',
      categoryLabels,
      categories.map((group) => chartValue(group.hours)),
      'BD Hrs',
    ),
    barChart(
      'ch-a2-catcnt',
      categoryLabels,
      categories.map((group) => group.count),
      '# Breakdowns',
    ),
    barChart(
      'ch-a2-cellhrs',
      cellLabels,
      cells.map((group) => chartValue(group.hours)),
      'BD Hrs',
    ),
    barChart(
      'ch-a2-cellcnt',
      cellLabels,
      cells.map((group) => group.count),
      '# Breakdowns',
    ),
    barChart(
      'ch-a2-catavghrs',
      categoryLabels,
      categories.map((group) => chartValue(hoursPerMachine(group))),
      'Avg BD Hrs / Machine',
    ),
    barChart(
      'ch-a2-catavgcnt',
      categoryLabels,
      categories.map((group) => chartValue(countPerMachine(group))),
      'Avg Breakdowns / Machine',
    ),
    barChart(
      'ch-a2-cellavghrs',
      cellLabels,
      cells.map((group) => chartValue(hoursPerMachine(group))),
      'Avg BD Hrs / Machine',
    ),
    barChart(
      'ch-a2-cellavgcnt',
      cellLabels,
      cells.map((group) => chartValue(countPerMachine(group))),
      'Avg Breakdowns / Machine',
    ),
  ];
}

function a2Tables(ctx: A2Context, categories: readonly A2Group[], cells: readonly A2Group[]) {
  const summary = [
    summaryTable(
      { title: 'By Category — Detail', firstHeader: 'Category' },
      (group) => normalizeLabel(group.label),
      categories,
      ctx.totalHours,
    ),
    summaryTable(
      { title: 'By Cell — Detail', firstHeader: 'Cell' },
      (group) => cellName(group.label),
      cells,
      ctx.totalHours,
    ),
  ];
  const detail = ctx.categories.map((category) => machineTable(ctx, category, ctx.totalHours));
  return [...summary, ...detail];
}

/**
 * The A2 figure: the key's page shape, sixteen tables and eight charts. An empty production fleet or no breakdown
 * rows has no page to print, so the figure is null rather than a fabricated zero. The drill names every breakdown
 * ticket the figure read, production-filtered, in the order the rows were read.
 */
export const a2CategoryCellFigure: Computer = ({ data, asOf }) => {
  const ctx = buildContext(data);
  if (ctx.machines.length === 0 || ctx.entries.length === 0) return { value: null, drillIds: [] };
  const categories = categoryGroups(ctx);
  const cells = cellGroups(ctx);
  const value = {
    screen: 'a2-category-cell',
    asOf,
    pages: [
      {
        page: 'a2',
        title: 'Category & Cell Analysis',
        kpis: [],
        tables: a2Tables(ctx, categories, cells),
        charts: charts(categories, cells),
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: ctx.entries.map((entry) => entry.row.ticket.id),
  };
};
