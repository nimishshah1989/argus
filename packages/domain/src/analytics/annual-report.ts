import type { AnalyticsProfile } from '@uptimo/shared';
import {
  addedTable,
  categoryTable,
  cellTable,
  numberText,
  percentText,
  shareOf,
  tableOf,
  teamTable,
  topMachinesTable,
  type MonthPoint,
  type Table,
} from './annual-report-tables.js';
import { machineAge } from './machine-facts.js';
import {
  DASH,
  MONTH_NAMES,
  MONTHS_SHORT,
  codeLabel,
  dateText,
  groupBy,
  machineLabel,
  monthWindow,
  productionMachines,
  reportEntries,
  reportStats,
  type ReportStats,
} from './report-period.js';
import { effectiveHours, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The annual report (ticket 45, packet 45b): 1 January of `asOf`'s year through `asOf`, as the platform printed it
 * on 11 November 2026 - the month and quarter tables, the machine Pareto and its fleet breakdowns, the team, the
 * PM and long-breakdown tables, the machines added month by month, the blank commentary form and the two charts.
 * The figure is pure: the same data, date and profile always give the same page. The fleet, cell, category, team
 * and addition tables are in `annual-report-tables.ts`.
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

/** The report's period: its year, its first day, the run date and the last month it touches. */
export interface AnnualPeriod {
  year: number;
  start: string;
  end: string;
  /** 1 = January. */
  lastMonth: number;
}

const TOP_CAUSES = 8;
const LONG_ROWS = 8;
const PARETO_BARS = 15;
const COMMENTARY_ROWS = 5;

const AGE_BANDS: ReadonlyArray<{ label: string; low: number; high: number }> = [
  { label: '0-5 yrs', low: 0, high: 5 },
  { label: '5-10 yrs', low: 5, high: 10 },
  { label: '10-15 yrs', low: 10, high: 15 },
  { label: '15-20 yrs', low: 15, high: 20 },
  { label: '20+ yrs', low: 20, high: Number.POSITIVE_INFINITY },
];

/** The annual period: 1 January of `asOf`'s year through `asOf`, its last month included. */
export function annualPeriod(asOf: string): AnnualPeriod {
  const year = Number(asOf.slice(0, 4));
  return { year, start: `${year}-01-01`, end: asOf, lastMonth: Number(asOf.slice(5, 7)) };
}

/** Every month of the report year to the run date, a month whose last day is past it marked partial. */
function monthPoints(
  entries: readonly SourcedReport[],
  machines: readonly MachineRow[],
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
  period: AnnualPeriod,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let month = 1; month <= period.lastMonth; month += 1) {
    const window = monthWindow(period.year, month);
    const partial = window.end > period.end;
    points.push({
      index: month,
      partial,
      label: `${MONTH_NAMES[month - 1]}${partial ? ' (to date)' : ''}`,
      stats: reportStats(entries, machines, profile, {
        from: window.start,
        to: partial ? period.end : window.end,
      }),
    });
  }
  return points;
}

/** One quarter of the year: its number, whether it runs past the run date, and its stats. */
interface QuarterPoint {
  q: number;
  partial: boolean;
  stats: ReportStats;
}

/** Every quarter that has started by the run date, the last one cut at it when it is still running. */
function quarterPoints(
  entries: readonly SourcedReport[],
  machines: readonly MachineRow[],
  profile: Pick<AnalyticsProfile, 'prodHrsPerDay' | 'workDaysPerYear'>,
  period: AnnualPeriod,
): QuarterPoint[] {
  const points: QuarterPoint[] = [];
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    const first = monthWindow(period.year, quarter * 3 - 2);
    if (first.start > period.end) break;
    const last = monthWindow(period.year, quarter * 3);
    const partial = last.end > period.end;
    points.push({
      q: quarter,
      partial,
      stats: reportStats(entries, machines, profile, {
        from: first.start,
        to: partial ? period.end : last.end,
      }),
    });
  }
  return points;
}

/** A change against the window before it: an arrow and a whole percent, or a dash with nothing to compare. */
function changeText(current: number, previous: number): string {
  if (previous === 0) return DASH;
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? '▲' : '▼'} ${numberText(Math.abs(change), 0)}%`;
}

/** The key's "Month by month": each month's counts and hours, its change, MTTR, BD %, PM and availability. */
function monthTable(points: readonly MonthPoint[]): Table {
  const rows = points.map((point, index) => {
    const stats = point.stats;
    return [
      point.label,
      String(stats.count),
      numberText(stats.hours, 1),
      index === 0 ? DASH : changeText(stats.hours, points[index - 1]!.stats.hours),
      stats.count > 0 ? numberText(stats.mttr, 2) : DASH,
      percentText(stats.bdPct),
      numberText(stats.pmHours, 1),
      percentText(stats.avail),
    ];
  });
  return tableOf(
    'Month by month',
    [
      'Month',
      'Breakdowns',
      'Downtime hrs',
      'vs prior month',
      'MTTR',
      'BD %',
      'PM hrs',
      'Availability',
    ],
    rows,
  );
}

/** The key's "Quarter by quarter": the same arithmetic for each quarter that has started. */
function quarterTable(points: readonly QuarterPoint[]): Table {
  const rows = points.map((point, index) => {
    const stats = point.stats;
    return [
      `Q${point.q}${point.partial ? ' (to date)' : ''}`,
      String(stats.count),
      numberText(stats.hours, 0),
      index === 0 ? DASH : changeText(stats.hours, points[index - 1]!.stats.hours),
      stats.count > 0 ? numberText(stats.mttr, 2) : DASH,
      percentText(stats.bdPct),
      percentText(stats.avail),
    ];
  });
  return tableOf(
    'Quarter by quarter',
    ['Quarter', 'Breakdowns', 'Downtime hrs', 'vs prior quarter', 'MTTR', 'BD %', 'Availability'],
    rows,
  );
}

/** The key's "By cause": the year's eight heaviest maintenance codes and their shares. */
function causeTable(data: EngineData, stats: ReportStats): Table {
  const rows = groupBy(stats.breakdowns, (row) => (row.report.maintCode ?? '').trim() || DASH)
    .slice(0, TOP_CAUSES)
    .map((group) => [
      codeLabel(group.key, data.lists),
      String(group.n),
      numberText(group.h, 0),
      shareOf(group.h, stats.hours),
    ]);
  return tableOf('By cause', ['Code', 'Breakdowns', 'Hours', 'Share'], rows);
}

/** The key's "Machine age": each band's machines, breakdowns, hours and hours per machine. */
function ageTable(machines: readonly MachineRow[], stats: ReportStats, asOf: string): Table {
  const rows = AGE_BANDS.map((band) => {
    const ids = machines
      .filter((machine) => {
        const age = machineAge(machine, asOf);
        return age !== null && age >= band.low && age < band.high;
      })
      .map((machine) => machine.id);
    const banded = new Set(ids);
    const breakdowns = stats.breakdowns.filter((row) => banded.has(row.report.machineId));
    const hours = breakdowns.reduce((total, row) => total + effectiveHours(row.report), 0);
    return [
      band.label,
      String(ids.length),
      String(breakdowns.length),
      numberText(hours, 0),
      numberText(ids.length > 0 ? hours / ids.length : 0, 1),
    ];
  });
  return tableOf(
    'Machine age',
    ['Age band', 'Machines', 'Breakdowns', 'Hours', 'Hrs / machine'],
    rows,
  );
}

/** The key's PM table: each month's PM entries and their hours. */
function pmTable(points: readonly MonthPoint[]): Table {
  const rows = points.map((point) => [
    MONTHS_SHORT[point.index - 1]!,
    String(point.stats.pmCount),
    numberText(point.stats.pmHours, 1),
  ]);
  return tableOf(
    'Preventive maintenance and long breakdowns',
    ['Month', 'PM entries', 'PM hours'],
    rows,
  );
}

/** A report's recorded hours: the platform's own figure, never a NO-DT row's zero downtime. */
const recordedHours = (row: SourcedReport): number =>
  row.report.recordedHours ?? row.report.downtimeMin / 60;

/** The key's long-breakdown table: the year's eight worst rows over the Why-Why threshold. */
function longTable(
  data: EngineData,
  stats: ReportStats,
  profile: Pick<AnalyticsProfile, 'whyWhyThresholdHours'>,
): Table {
  const machines = new Map(data.machines.map((machine) => [machine.id, machine]));
  const rows = [...stats.breakdowns]
    .filter((row) => recordedHours(row) > profile.whyWhyThresholdHours)
    .sort((left, right) => recordedHours(right) - recordedHours(left))
    .slice(0, LONG_ROWS)
    .map((row) => [
      dateText(row.report.date),
      machineLabel(machines.get(row.report.machineId), row.report.machineId),
      numberText(recordedHours(row), 1),
      row.report.problem ?? '',
    ]);
  return tableOf(
    'Preventive maintenance and long breakdowns',
    ['Date', 'Machine', 'Hours', 'Problem'],
    rows,
  );
}

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

/** `ch-ry-month`: the year's breakdowns and hours by month, the partial month starred. */
function monthChart(points: readonly MonthPoint[]): Chart {
  return chartOf(
    'ch-ry-month',
    points.map((point) => `${MONTHS_SHORT[point.index - 1]}${point.partial ? '*' : ''}`),
    [
      { label: 'Breakdowns', data: points.map((point) => point.stats.count) },
      {
        label: 'Downtime hrs',
        data: points.map((point) => Math.round(point.stats.hours * 10) / 10),
      },
    ],
  );
}

/** `ch-ry-pareto`: the fifteen costliest machines' hours and their running share of the year. */
function paretoChart(stats: ReportStats): Chart {
  let cumulative = 0;
  const top = groupBy(stats.breakdowns, (row) => row.report.machineId).slice(0, PARETO_BARS);
  return chartOf(
    'ch-ry-pareto',
    top.map((group) => group.key),
    [
      { label: 'Downtime hrs', data: top.map((group) => Math.round(group.h * 10) / 10) },
      {
        label: 'Cumulative %',
        data: top.map((group) => {
          cumulative += group.h;
          return Math.round((cumulative / stats.hours) * 1000) / 10;
        }),
      },
    ],
  );
}

/**
 * The annual report's value and the tickets behind it: the whole page for 1 January of `asOf`'s year through
 * `asOf`, or `null` with no ids when the plant has no production machine or no breakdown in the year. The drill
 * names every breakdown ticket in the year; the engine dedupes and sorts them.
 */
export function annualReport(
  data: EngineData,
  profile: AnalyticsProfile,
  asOf: string,
): { value: FigureValue | null; drillIds: string[] } {
  const machines = productionMachines(data);
  const entries = reportEntries(data);
  const period = annualPeriod(asOf);
  const stats = reportStats(entries, machines, profile, { from: period.start, to: period.end });
  if (stats.count === 0) return { value: null, drillIds: [] };
  const months = monthPoints(entries, machines, profile, period);
  const quarters = quarterPoints(entries, machines, profile, period);
  const page: Page = {
    page: 'rep_year',
    title: 'Annual Report',
    kpis: [],
    tables: [
      monthTable(months),
      quarterTable(quarters),
      topMachinesTable(data, stats, months, asOf),
      cellTable(data, stats, profile),
      causeTable(data, stats),
      categoryTable(data, stats, profile),
      ageTable(machines, stats, asOf),
      teamTable(data, stats),
      pmTable(months),
      longTable(data, stats, profile),
      addedTable(data, period.year, period.lastMonth),
      tableOf(
        '',
        ['Action', 'Owner', 'Due date'],
        Array.from({ length: COMMENTARY_ROWS }, () => ['', '', '']),
      ),
    ],
    charts: [monthChart(months), paretoChart(stats)],
  };
  return {
    value: { screen: 'annual-report', asOf, pages: [page] } as unknown as FigureValue,
    drillIds: stats.breakdowns.map((row) => row.ticket.id),
  };
}

/** The registered figure: `runWith` reads the same computation the PDF route calls directly. */
export const annualReportFigure: Computer = ({ data, asOf, profile }) =>
  annualReport(data, profile, asOf);
