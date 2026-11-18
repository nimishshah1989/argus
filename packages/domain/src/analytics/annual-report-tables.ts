import type { AnalyticsProfile } from '@uptimo/shared';
import { availableHours } from './availability.js';
import { availableByCell } from './hours.js';
import { machineAge } from './machine-facts.js';
import {
  DASH,
  MONTHS_SHORT,
  annualHours,
  boughtOn,
  categoriesOf,
  categoryName,
  categoryOf,
  cellGroupKey,
  cellName,
  groupBy,
  machineLabel,
  productionMachines,
  type ReportStats,
} from './report-period.js';
import { effectiveHours } from './rows.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * The annual report's fleet, cell, category, team and fleet-growth tables (ticket 45, packet 45b). They live
 * beside `annual-report.ts` because the hard 400-line rail cannot hold the whole page and its twelve tables in one
 * file; the figure still builds the page and keeps the key's order.
 */

/** One printed table: the key's title, header, cells and row count. */
export interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

/** The report's table builder, shared by the page's tables. */
export const tableOf = (title: string, header: string[], rows: string[][]): Table => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});

/**
 * The platform's own number text (`toLocaleString`): a summed value just under a half prints down, so 117.45
 * hours is `117.4` in the table, while a chart series rounds with `Math.round` and prints `117.5`. That one cell
 * is why the annual report owns this formatter: `formatNumber`'s `Math.round` would print `117.5` in both.
 */
const FORMATS = [0, 1, 2].map(
  (decimals) =>
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
);

/** A grouped, fixed-decimal number, exactly as the platform prints it. */
export const numberText = (value: number, decimals: 0 | 1 | 2): string =>
  FORMATS[decimals]!.format(value);

/** BD % and availability: the platform's own `toFixed(2)`. */
export const percentText = (value: number): string => `${(value * 100).toFixed(2)}%`;

/** A share of a whole, printed as one decimal of a percent; a zero whole has no share. */
export const shareOf = (part: number, whole: number): string =>
  whole === 0 ? DASH : `${numberText((part / whole) * 100, 1)}%`;

/** One month of the report year: its window, its partial flag and its stats. */
export interface MonthPoint {
  /** 1 = January. */
  index: number;
  partial: boolean;
  label: string;
  stats: ReportStats;
}

const TOP_MACHINES = 10;
const TOP_MONTHS = 5;
const TEAM_ROWS = 8;
/** A month with no machine added is a dot, as the platform prints it. */
const ZERO_MONTH = '·';

const machinesById = (data: EngineData): Map<string, MachineRow> =>
  new Map(data.machines.map((machine) => [machine.id, machine]));

/** How many of the year's months a machine spent in that month's top five by hours. */
function monthsInTopFive(months: readonly MonthPoint[]): Map<string, number> {
  const counted = new Map<string, number>();
  for (const month of months) {
    const top = groupBy(month.stats.breakdowns, (row) => row.report.machineId).slice(0, TOP_MONTHS);
    for (const group of top) counted.set(group.key, (counted.get(group.key) ?? 0) + 1);
  }
  return counted;
}

/** The key's "Where the downtime comes from": the year's ten costliest machines and their shares. */
export function topMachinesTable(
  data: EngineData,
  stats: ReportStats,
  months: readonly MonthPoint[],
  asOf: string,
): Table {
  const machines = machinesById(data);
  const counted = monthsInTopFive(months);
  let cumulative = 0;
  const rows = groupBy(stats.breakdowns, (row) => row.report.machineId)
    .slice(0, TOP_MACHINES)
    .map((group, index) => {
      cumulative += group.h;
      const machine = machines.get(group.key);
      const age = machine === undefined ? null : machineAge(machine, asOf);
      return [
        String(index + 1),
        machineLabel(machine, group.key),
        machine === undefined ? '' : (categoryName(machine) ?? ''),
        age === null ? DASH : `${age}y`,
        machine?.cell?.trim() || DASH,
        String(group.n),
        numberText(group.h, 1),
        shareOf(group.h, stats.hours),
        shareOf(cumulative, stats.hours),
        String(counted.get(group.key) ?? 0),
      ];
    });
  return tableOf(
    'Where the downtime comes from',
    [
      '#',
      'Machine',
      'Category',
      'Age',
      'Cell',
      'Breakdowns',
      'Hours',
      'Share',
      'Cumulative',
      'Months in top 5',
    ],
    rows,
  );
}

/** The cell a machine is in now, as the report groups it: its trimmed cell, or the dash when blank or unlisted. */
const currentCell = (machine: MachineRow, cells: readonly string[]): string => {
  const cell = machine.cell?.trim() ?? '';
  return cell !== '' && cells.includes(cell) ? cell : DASH;
};

/** The key's "By cell": every cell with breakdowns, its fleet, its hours and its time-weighted BD %. */
export function cellTable(
  data: EngineData,
  stats: ReportStats,
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
): Table {
  const machines = productionMachines(data);
  const cells = data.settings?.cells ?? [];
  const annual = annualHours(profile);
  const index = machinesById(data);
  const groups = groupBy(stats.breakdowns, (row) => {
    const machine = index.get(row.report.machineId);
    return machine === undefined ? DASH : cellGroupKey(machine, data.moves, row.report.date, cells);
  });
  const rows = groups.map((group) => {
    const available = availableByCell(
      machines,
      data.moves,
      { from: stats.start, to: stats.end, annualHours: annual },
      group.key,
    );
    const equivalents = stats.fraction > 0 ? available / (annual * stats.fraction) : 0;
    return [
      cellName(group.key),
      String(machines.filter((machine) => currentCell(machine, cells) === group.key).length),
      String(group.n),
      numberText(group.h, 0),
      numberText(equivalents > 0 ? group.h / equivalents : 0, 1),
      percentText(available > 0 ? group.h / available : 0),
    ];
  });
  return tableOf(
    'By cell',
    ['Cell', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine', 'BD %'],
    rows,
  );
}

/** The key's "Machine categories — reliability": hours, MTTR and MTBF per category with breakdowns. */
export function categoryTable(
  data: EngineData,
  stats: ReportStats,
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
): Table {
  const machines = productionMachines(data);
  const annual = annualHours(profile);
  const index = machinesById(data);
  const groups = groupBy(stats.breakdowns, (row) => {
    const machine = index.get(row.report.machineId);
    return machine === undefined ? null : categoryName(machine);
  });
  const rows = groups.map((group) => {
    const inCategory = machines.filter((machine) => categoryOf(machine) === group.key);
    const available = inCategory.reduce(
      (total, machine) => total + availableHours(machine, annual, stats.start, stats.end),
      0,
    );
    return [
      group.key,
      String(inCategory.length),
      String(group.n),
      numberText(group.h, 0),
      numberText(inCategory.length > 0 ? group.h / inCategory.length : 0, 1),
      numberText(group.n > 0 ? group.h / group.n : 0, 2),
      numberText(group.n > 0 ? (available - group.h) / group.n : available, 0),
    ];
  });
  return tableOf(
    'Machine categories — reliability',
    ['Category', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine', 'MTTR', 'MTBF'],
    rows,
  );
}

/** The key's "Maintenance team": the Settings list's members with a job this year, the busiest eight. */
export function teamTable(data: EngineData, stats: ReportStats): Table {
  const people = new Map(data.people.map((person) => [person.code, person]));
  const codes =
    data.settings?.teamCodes ??
    data.people.filter((person) => person.team === 'maintenance').map((person) => person.code);
  const rows = codes
    .map((code) => {
      const person = people.get(code);
      const attended = stats.breakdowns.filter((row) => row.report.doneBy.includes(code));
      return {
        // The platform's team entries carry a printed type; our person rows keep the role, so a vendor prints
        // `Vendor` and every other member the platform's own `Team` word.
        name: `${person?.displayName ?? code} ${person?.team === 'vendor' ? 'Vendor' : 'Team'}`,
        count: attended.length,
        hours: attended.reduce((total, row) => total + effectiveHours(row.report), 0),
        pm: stats.pm.filter((row) => row.report.doneBy.includes(code)).length,
      };
    })
    .filter((line) => line.count > 0 || line.pm > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, TEAM_ROWS)
    .map((line) => [
      line.name,
      String(line.count),
      numberText(line.hours, 0),
      line.count > 0 ? numberText(line.hours / line.count, 2) : DASH,
      String(line.pm),
    ]);
  return tableOf('Maintenance team', ['Name', 'Breakdowns', 'Hours', 'Avg hrs', 'PM visits'], rows);
}

/** A production machine with the purchase date the fleet table counts it from. */
interface Bought {
  machine: MachineRow;
  day: string;
}

/** The key's "Machines added month by month": a row per category, a column per month, and the totals. */
export function addedTable(data: EngineData, year: number, lastMonth: number): Table {
  const months = Array.from(
    { length: lastMonth },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  );
  const screen = productionMachines(data);
  const bought = screen.flatMap((machine): Bought[] => {
    const day = boughtOn(machine);
    return day === null ? [] : [{ machine, day }];
  });
  const lines = categoriesOf(screen)
    .map((category) => {
      const inCategory = bought.filter((entry) => categoryOf(entry.machine) === category);
      const start = inCategory.filter((entry) => entry.day < `${year}-01-01`).length;
      const perMonth = months.map(
        (month) => inCategory.filter((entry) => entry.day.slice(0, 7) === month).length,
      );
      const added = perMonth.reduce((total, count) => total + count, 0);
      return { category, start, perMonth, added, end: start + added };
    })
    .filter((line) => line.start > 0 || line.added > 0);
  const total = {
    start: lines.reduce((sum, line) => sum + line.start, 0),
    perMonth: months.map((_, index) => lines.reduce((sum, line) => sum + line.perMonth[index]!, 0)),
    added: lines.reduce((sum, line) => sum + line.added, 0),
  };
  const rows = [
    ...lines.map((line) => [
      line.category,
      numberText(line.start, 0),
      ...line.perMonth.map((count) => (count === 0 ? ZERO_MONTH : numberText(count, 0))),
      numberText(line.added, 0),
      numberText(line.end, 0),
    ]),
    [
      'Total',
      numberText(total.start, 0),
      ...total.perMonth.map((count) => numberText(count, 0)),
      numberText(total.added, 0),
      numberText(total.start + total.added, 0),
    ],
  ];
  return tableOf(
    'Machines added month by month',
    ['Category', `Start of ${year}`, ...MONTHS_SHORT.slice(0, lastMonth), 'Added', 'End'],
    rows,
  );
}
