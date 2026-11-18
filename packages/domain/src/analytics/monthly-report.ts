import type { AnalyticsProfile } from '@uptimo/shared';
import { addedTable, tableOf, teamTable, type Table } from './monthly-report-tables.js';
import {
  DASH,
  MONTH_NAMES,
  MONTHS_SHORT,
  categoryName,
  cellGroupKey,
  cellName,
  codeLabel,
  dateText,
  daysInMonth,
  groupBy,
  hoursDelta,
  hoursText,
  machineLabel,
  monthlyPeriod,
  monthWindow,
  productionMachines,
  reportEntries,
  reportStats,
  type MonthPeriod,
  type MonthWindow,
  type ReportGroup,
  type ReportStats,
} from './report-period.js';
import { effectiveHours, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The monthly report (ticket 45, packet 45a): the complete month before `asOf`'s month, against the month before
 * it, as the platform printed it on 11 November 2026 - four "Where the time went" tables, the longest breakdowns,
 * the maintenance team, the machines added, the blank commentary form and the two charts. The figure is pure: the
 * same data, date and profile always give the same page. The period, the stats, the grouping order and the printed
 * labels are in `report-period.ts`; the team and added tables are in `monthly-report-tables.ts`.
 */

interface Chart {
  id: string;
  type: string;
  axes: { x: string; y: string; y1: string };
  tickLabels: { x: string[]; y: string[]; y1: string[] };
  labels: Array<string | number>;
  datasets: Array<{ label: string; data: Array<number | null> }>;
}

interface Page {
  page: string;
  title: string;
  kpis: never[];
  tables: Table[];
  charts: Chart[];
}

const TOP_MACHINES = 5;
const TOP_CELLS = 9;
const TOP_CATEGORIES = 5;
const TOP_CODES = 6;
const LONGEST_ROWS = 10;
const COMMENTARY_ROWS = 5;

const chartOf = (
  id: string,
  labels: Array<string | number>,
  datasets: Chart['datasets'],
): Chart => ({
  id,
  type: 'undefined',
  axes: { x: '', y: '', y1: '' },
  tickLabels: { x: [], y: [], y1: [] },
  labels,
  datasets,
});

const byKey = (groups: readonly ReportGroup[]): Map<string, ReportGroup> =>
  new Map(groups.map((group) => [group.key, group]));

interface RankOptions {
  hasPrev: boolean;
  labelOf: (key: string) => string;
  max: number;
}

/** One "Where the time went" table: the current groups cut to `max`, with the comparison month beside them. */
function rankTable(
  label: string,
  current: readonly ReportGroup[],
  previous: readonly ReportGroup[],
  options: RankOptions,
): Table {
  const { hasPrev, labelOf, max } = options;
  const before = byKey(previous);
  const rows = current.slice(0, max).map((group) => {
    const earlier = before.get(group.key)?.h ?? 0;
    return [
      labelOf(group.key),
      String(group.n),
      hoursText(group.h),
      hasPrev ? hoursText(earlier) : DASH,
      hoursDelta(group.h, earlier, hasPrev),
    ];
  });
  return tableOf(
    'Where the time went',
    [label, 'Breakdowns', 'Hours', 'Prev. hrs', 'Change'],
    rows,
  );
}

/** The month's longest breakdowns: effective hours descending, the first ten with hours, problem cut at 47. */
function longestTable(
  data: EngineData,
  breakdowns: readonly SourcedReport[],
  names: ReadonlyMap<string, string>,
): Table {
  const machines = new Map(data.machines.map((machine) => [machine.id, machine]));
  const rows = [...breakdowns]
    .sort((left, right) => effectiveHours(right.report) - effectiveHours(left.report))
    .slice(0, LONGEST_ROWS)
    .filter((row) => effectiveHours(row.report) > 0)
    .map((row) => {
      const problem = row.report.problem ?? '';
      const doneBy = row.report.doneBy.map((code) => names.get(code) ?? code).join(', ');
      return [
        dateText(row.report.date),
        machineLabel(machines.get(row.report.machineId), row.report.machineId),
        problem.length > 48 ? `${problem.slice(0, 47)}…` : problem,
        (row.report.maintCode ?? '').trim() || DASH,
        doneBy || DASH,
        hoursText(effectiveHours(row.report)),
      ];
    });
  return tableOf(
    'Longest breakdowns this period',
    ['Date', 'Machine', 'Problem', 'Code', 'Done by', 'Hours'],
    rows,
  );
}

/** One day's reports counted and timed, indexed from 0 for the 1st. */
function daySeries(
  rows: readonly SourcedReport[],
  days: number,
): { counts: number[]; hours: number[] } {
  const counts = Array.from({ length: days }, () => 0);
  const hours = Array.from({ length: days }, () => 0);
  for (const row of rows) {
    const day = Number(row.report.date.slice(8, 10)) - 1;
    if (day < 0 || day >= days) continue;
    counts[day] = (counts[day] ?? 0) + 1;
    hours[day] = (hours[day] ?? 0) + effectiveHours(row.report);
  }
  return { counts, hours };
}

/** `ch-rp-daily`: the month's breakdowns and hours by day, against the comparison month's counts. */
function dailyChart(
  period: MonthPeriod,
  current: readonly SourcedReport[],
  previous: readonly SourcedReport[],
): Chart {
  const days = daysInMonth(period.current.year, period.current.month);
  const previousDays = daysInMonth(period.previous.year, period.previous.month);
  const limit = Math.max(days, previousDays);
  const now = daySeries(current, days);
  const before = daySeries(previous, previousDays);
  const previousCounts = [
    ...before.counts,
    ...Array.from({ length: limit - previousDays }, () => null),
  ];
  return chartOf(
    'ch-rp-daily',
    Array.from({ length: limit }, (_, index) => index + 1),
    [
      { label: `${MONTH_NAMES[period.current.month - 1]} breakdowns`, data: now.counts },
      {
        label: `${MONTH_NAMES[period.current.month - 1]} hrs`,
        data: now.hours.map((value) => Math.round(value * 10) / 10),
      },
      { label: `${MONTH_NAMES[period.previous.month - 1]} breakdowns`, data: previousCounts },
    ],
  );
}

/** `ch-rp-12m`: the twelve months ending at the report month, leading empty months dropped. */
function yearChart(
  entries: readonly SourcedReport[],
  machines: readonly MachineRow[],
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
  period: MonthPeriod,
): Chart {
  const index = period.current.year * 12 + period.current.month - 1;
  const months: Array<{ window: MonthWindow; stats: ReportStats }> = [];
  for (let back = 11; back >= 0; back -= 1) {
    const at = index - back;
    const window = monthWindow(Math.floor(at / 12), (at % 12) + 1);
    months.push({
      window,
      stats: reportStats(entries, machines, profile, { from: window.start, to: window.end }),
    });
  }
  while (months.length > 1 && months[0]!.stats.count === 0 && months[0]!.stats.pmCount === 0) {
    months.shift();
  }
  return chartOf(
    'ch-rp-12m',
    months.map(({ window }) => `${MONTHS_SHORT[window.month - 1]} ${String(window.year).slice(2)}`),
    [
      { label: 'Breakdowns', data: months.map(({ stats }) => stats.count) },
      {
        label: 'Downtime hrs',
        data: months.map(({ stats }) => Math.round(stats.hours * 10) / 10),
      },
    ],
  );
}

/** The stats the page prints: the report month, its comparison, and whether the comparison exists. */
interface PageStats {
  current: ReportStats;
  previous: ReportStats;
  hasPrev: boolean;
}

/** The machine map and the four group keys the time-went tables read. */
function reportKeys(data: EngineData) {
  const machines = new Map(data.machines.map((machine) => [machine.id, machine]));
  const cells = data.settings?.cells ?? [];
  return {
    machines,
    machineKey: (row: SourcedReport): string => row.report.machineId,
    cellKey: (row: SourcedReport): string => {
      const machine = machines.get(row.report.machineId);
      return machine === undefined
        ? DASH
        : cellGroupKey(machine, data.moves, row.report.date, cells);
    },
    categoryKey: (row: SourcedReport): string | null => {
      const machine = machines.get(row.report.machineId);
      return machine === undefined ? null : categoryName(machine);
    },
    codeKey: (row: SourcedReport): string => (row.report.maintCode ?? '').trim() || DASH,
  };
}

/** The whole `rep_month` page, in the key's order. */
function pageOf(
  data: EngineData,
  profile: AnalyticsProfile,
  period: MonthPeriod,
  stats: PageStats,
): Page {
  const { current, previous, hasPrev } = stats;
  const { machines, machineKey, cellKey, categoryKey, codeKey } = reportKeys(data);
  const names = new Map(data.people.map((person) => [person.code, person.displayName]));
  const groups = {
    machine: groupBy(current.breakdowns, machineKey),
    cell: groupBy(current.breakdowns, cellKey),
    category: groupBy(current.breakdowns, categoryKey),
    code: groupBy(current.breakdowns, codeKey),
  };
  const earlier = {
    machine: groupBy(previous.breakdowns, machineKey),
    cell: groupBy(previous.breakdowns, cellKey),
    category: groupBy(previous.breakdowns, categoryKey),
    code: groupBy(previous.breakdowns, codeKey),
  };
  return {
    page: 'rep_month',
    title: 'Monthly Report',
    kpis: [],
    tables: [
      rankTable('Machine', groups.machine, earlier.machine, {
        hasPrev,
        labelOf: (key) => machineLabel(machines.get(key), key),
        max: TOP_MACHINES,
      }),
      rankTable('Cell', groups.cell, earlier.cell, { hasPrev, labelOf: cellName, max: TOP_CELLS }),
      rankTable('Category', groups.category, earlier.category, {
        hasPrev,
        labelOf: (key) => key,
        max: TOP_CATEGORIES,
      }),
      rankTable('Code', groups.code, earlier.code, {
        hasPrev,
        labelOf: (key) => codeLabel(key, data.lists),
        max: TOP_CODES,
      }),
      longestTable(data, current.breakdowns, names),
      teamTable(data, current, previous, { period, hasPrev }),
      addedTable(data, period, hasPrev),
      tableOf(
        '',
        ['Action', 'Owner', 'Due date'],
        Array.from({ length: COMMENTARY_ROWS }, () => ['', '', '']),
      ),
    ],
    charts: [
      dailyChart(period, current.breakdowns, previous.breakdowns),
      yearChart(reportEntries(data), productionMachines(data), profile, period),
    ],
  };
}

/**
 * The monthly report's value and the tickets behind it: the whole page for the complete month before `asOf`'s
 * month, or `null` with no ids when the plant has no production machine or no breakdown in that month. The drill
 * names every October breakdown ticket in read order; the engine dedupes and sorts them.
 */
export function monthlyReport(
  data: EngineData,
  profile: AnalyticsProfile,
  asOf: string,
): { value: FigureValue | null; drillIds: string[] } {
  const machines = productionMachines(data);
  const entries = reportEntries(data);
  const period = monthlyPeriod(asOf);
  const current = reportStats(entries, machines, profile, {
    from: period.current.start,
    to: period.current.end,
  });
  if (current.count === 0) return { value: null, drillIds: [] };
  const previous = reportStats(entries, machines, profile, {
    from: period.previous.start,
    to: period.previous.end,
  });
  const hasPrev = previous.count > 0 || previous.pmCount > 0;
  const page = pageOf(data, profile, period, { current, previous, hasPrev });
  return {
    value: { screen: 'monthly-report', asOf, pages: [page] } as unknown as FigureValue,
    drillIds: current.breakdowns.map((row) => row.ticket.id),
  };
}

/** The registered figure: `runWith` reads the same computation the PDF route calls directly. */
export const monthlyReportFigure: Computer = ({ data, asOf, profile }) =>
  monthlyReport(data, profile, asOf);
