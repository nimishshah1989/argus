import { a10ProblemsFigure } from './a10-problems.js';
import { actionCenterFigure } from './action-center-figure.js';
import { annualReportFigure } from './annual-report.js';
import { a1BdPmFigure } from './a1-bd-pm.js';
import { a2CategoryCellFigure } from './a2-category-cell.js';
import { a3MttrMtbfFigure } from './a3-mttr-mtbf.js';
import { a4ManpowerFigure } from './a4-manpower.js';
import { a5EnergyFigure } from './a5-energy.js';
import { a6WhyWhyFigure } from './a6-why-why.js';
import { a9BottleneckTrendsFigure } from './a9-maintenance.js';
import { fixFinderFigure } from './fix-finder.js';
import { forecastLabFigure } from './forecast-lab.js';
import { moneyMattersFigure } from './money-matters.js';
import { monthlyReportFigure } from './monthly-report.js';
import { availableHours, availabilityWindow, daysInclusive } from './availability.js';
import { ageAnalysis } from './age.js';
import { breakdownLogFigure } from './breakdown-log.js';
import { cellChangeLog } from './cell-log.js';
import { compareFigure } from './compare.js';
import { bubbleChart, expansionTimeline } from './dashboard-charts.js';
import { breakdownFree, costliestProblems } from './dashboard-flags.js';
import { dataChecklist } from './data-checklist.js';
import { footprint } from './footprint.js';
import { isProduction } from './machine-facts.js';
import { machinePage } from './machine-page.js';
import { isHistory, isNoDowntime, isPm, sourcedReports, type SourcedReport } from './rows.js';
import { registers } from './registers.js';
import { shiftKpisBacklogFigure } from './backlog.js';
import { shiftKpisBreakdownMapFigure } from './breakdown-map.js';
import { shiftKpisShiftSplitFigure } from './shift-split.js';
import { reliabilityFigure } from './reliability.js';
import { shiftKpisCompareFigure } from './standard-kpis.js';
import { teamFocusFigure } from './team-focus.js';
import type { Computer, EngineData, MachineRow } from './types.js';

/**
 * A count of the machines in the named workbook lists, naming every machine it counted so a drill opens them. The
 * fixture carries each list as its segment (the rows of a list carry no segment of their own), so the count is
 * list-driven: it counts what the list holds, and excludes nothing by status or by a settings exclusion.
 */
function countSegments(...segments: readonly string[]): Computer {
  return ({ data }) => {
    const counted = data.machines.filter(
      (machine) => machine.segment !== null && segments.includes(machine.segment),
    );
    return { value: counted.length, drillIds: counted.map((machine) => machine.id) };
  };
}

/** The actual-breakdown rows: PM work is not a breakdown, and a NO-DT row records breakdown hours but no downtime,
 * so it keeps its own figure and stays out of the downtime totals (the key's sub-label says so). */
const isDowntime = (row: SourcedReport): boolean => !isPm(row) && !isNoDowntime(row);

/** The ticket ids behind a figure; each sourced report's ticket is in the snapshot, so every id drills. */
const ticketIds = (rows: readonly SourcedReport[]): string[] => rows.map((row) => row.ticket.id);

const minutes = (rows: readonly SourcedReport[]): number =>
  rows.reduce((sum, row) => sum + row.report.downtimeMin, 0);

/** The key prints hours to one decimal and the average to two: round to the key's own decimals, half up. */
const round = (value: number, decimals: 1 | 2): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const hours = (rows: readonly SourcedReport[]): number => round(minutes(rows) / 60, 1);

/** The breakdown rows whose machine is production data; an excluded machine's rows are never a production number. */
function productionReports(data: EngineData): SourcedReport[] {
  const excluded = new Set(
    data.machines.filter((machine) => machine.excludedFromProduction).map((machine) => machine.id),
  );
  return sourcedReports(data).filter((row) => !excluded.has(row.report.machineId));
}

/** The breakdown log the daily figures divide: history rows that are not PM (NO-DT still counts as a breakdown). */
const breakdownLog = (data: EngineData): SourcedReport[] =>
  productionReports(data).filter((row) => isHistory(row) && !isPm(row));

/** The days the breakdown log covers: its first to its last breakdown date, both included. */
function recordDays(rows: readonly SourcedReport[]): number {
  const dates = rows.map((row) => row.report.date).sort();
  const first = dates[0];
  const last = dates.at(-1);
  return first === undefined || last === undefined ? 0 : daysInclusive(first, last);
}

/** The production fleet's available hours and the machines they belong to, for one run. */
function plantAvailability(
  data: EngineData,
  profile: { prodHrsPerDay: number; workDaysPerYear: number },
  asOf: string,
): { hours: number; production: MachineRow[] } {
  const latest = sourcedReports(data)
    .filter(isHistory)
    .map((row) => row.report.date)
    .sort()
    .at(-1);
  const window = availabilityWindow(asOf, latest ?? null);
  const annual = profile.prodHrsPerDay * profile.workDaysPerYear;
  const production = data.machines.filter(isProduction);
  const available = production.reduce(
    (sum, machine) => sum + availableHours(machine, annual, window.from, window.to),
    0,
  );
  return { hours: available, production };
}

/**
 * The Dashboard's numbers, each from the workbook's own columns: breakdowns are the history log minus the PM rows
 * (the live app's own tickets are not breakdowns); downtime is actual breakdowns over both logs; PM and NO-DT are
 * their own selectors; and the average divides downtime by the CNC machines, as the key's sub-label says.
 *
 * The four Guide figures (packet 38.4) divide that same downtime by the production fleet's available hours: the
 * hours are the profile's annual hours spread month by month from 1 January to the run date, each machine from its
 * purchase date. The daily averages divide the key's own totals by the days the log covers, first to last included.
 */
export const dashboardComputers: Readonly<Record<string, Computer>> = {
  'dashboard.total-machines': countSegments('CNC', 'Conventional', 'Process'),
  'dashboard.utilities': countSegments('Utility'),
  'dashboard.dg-sets': countSegments('DG'),
  'dashboard.cnc-machines': countSegments('CNC'),
  'dashboard.conventional-machines': countSegments('Conventional'),
  'dashboard.process-machines': countSegments('Process'),
  'dashboard.total-breakdowns': ({ data }) => {
    // S2: the count reads the production filter, the same rows A1's numerator and the daily average read.
    const counted = breakdownLog(data);
    return { value: counted.length, drillIds: ticketIds(counted) };
  },
  'dashboard.total-downtime-hours': ({ data }) => {
    const counted = sourcedReports(data).filter(isDowntime);
    return { value: hours(counted), drillIds: ticketIds(counted) };
  },
  'dashboard.pm-hours': ({ data }) => {
    const counted = sourcedReports(data).filter(isPm);
    return { value: hours(counted), drillIds: ticketIds(counted) };
  },
  'dashboard.no-downtime-hours': ({ data }) => {
    const counted = sourcedReports(data).filter((row) => isHistory(row) && isNoDowntime(row));
    return { value: hours(counted), drillIds: ticketIds(counted) };
  },
  'dashboard.avg-bd-hours-per-machine': ({ data }) => {
    const downtime = sourcedReports(data).filter(isDowntime);
    const cnc = data.machines.filter((machine) => machine.segment === 'CNC').length;
    if (cnc === 0) return { value: 0, drillIds: [] };
    return { value: round(minutes(downtime) / 60 / cnc, 2), drillIds: ticketIds(downtime) };
  },
  'dashboard.plant-bd-pct': ({ data, asOf, profile }) => {
    const { hours: available } = plantAvailability(data, profile, asOf);
    const downtime = productionReports(data).filter(isDowntime);
    const value = available > 0 ? round((minutes(downtime) / 60 / available) * 100, 2) : 0;
    return { value, drillIds: ticketIds(downtime) };
  },
  'dashboard.fleet-availability': ({ data, asOf, profile }) => {
    const { hours: available, production } = plantAvailability(data, profile, asOf);
    const rows = productionReports(data);
    const lost = minutes(rows.filter(isDowntime)) + minutes(rows.filter(isPm));
    const value = available > 0 ? round((1 - lost / 60 / available) * 100, 2) : 0;
    return { value, drillIds: production.map((machine) => machine.id) };
  },
  'dashboard.avg-complaints-per-day': ({ data }) => {
    const counted = breakdownLog(data);
    const days = recordDays(counted);
    const value = days > 0 ? round(counted.length / days, 2) : 0;
    return { value, drillIds: ticketIds(counted) };
  },
  'dashboard.avg-bd-hours-per-day': ({ data }) => {
    const downtime = productionReports(data).filter(isDowntime);
    const days = recordDays(breakdownLog(data));
    const value = days > 0 ? round(minutes(downtime) / 60 / days, 2) : 0;
    return { value, drillIds: ticketIds(downtime) };
  },
  'dashboard.bubble-chart': bubbleChart,
  'dashboard.expansion-timeline': expansionTimeline,
  'dashboard.breakdown-free': breakdownFree,
  'dashboard.costliest-problems': costliestProblems,
  // Owner 38's data-quality report: a screen-level key, computed here with the Dashboard's numbers.
  'data-checklist': dataChecklist,
};

/** Owner 40's figures: the Breakdown Log and, as packets 40b to 40d land, A1 to A3. */
const breakdownComputers: Readonly<Record<string, Computer>> = {
  'breakdown-log': breakdownLogFigure,
  'a1-bd-pm': a1BdPmFigure,
  'a2-category-cell': a2CategoryCellFigure,
  'a3-mttr-mtbf': a3MttrMtbfFigure,
};

/** Owner 41's four figures, whole: A4 manpower, A5 energy, A6 Why-Why and A10 problems. */
const manpowerComputers: Readonly<Record<string, Computer>> = {
  'a4-manpower': a4ManpowerFigure,
  'a5-energy': a5EnergyFigure,
  'a6-why-why': a6WhyWhyFigure,
  'a10-problems': a10ProblemsFigure,
};

/** Owner 42's figures: the bottleneck and forecast page and, as packet 42d lands, the Forecast Lab. */
const forecastComputers: Readonly<Record<string, Computer>> = {
  // 42c composes 42a's and 42b's page and fills the trend tables, repeat faults and both charts.
  'a9-bottleneck-forecast': a9BottleneckTrendsFigure,
  // 42d backtests the four methods and prints the lab's two tables and one chart.
  'forecast-lab': forecastLabFigure,
};

/** Owner 43's figures: compare, team, money and Fix Finder. */
const compareComputers: Readonly<Record<string, Computer>> = {
  compare: compareFigure,
  'team-focus': teamFocusFigure,
  'money-matters': moneyMattersFigure,
  'fix-finder': fixFinderFigure,
};

/**
 * Owner 44's Action Center figure. The screen's money tile, `action-center.spares-spend`, stays `not_computed`
 * until the spare-cost screen lands (46/47): the spares rule's share is in its title, never a rupee in the value.
 */
const actionCenterComputers: Readonly<Record<string, Computer>> = {
  'action-center': actionCenterFigure,
};

/** Owner 45's reports: the monthly figure (45a) and the annual figure (45b). */
const reportComputers: Readonly<Record<string, Computer>> = {
  'monthly-report': monthlyReportFigure,
  'annual-report': annualReportFigure,
};

/** Owner 48's shift-calendar figures: the comparison, the shift split, the backlog and the breakdown map. */
const shiftComputers: Readonly<Record<string, Computer>> = {
  'shift-kpis.compare': shiftKpisCompareFigure,
  'shift-kpis.shift-split': shiftKpisShiftSplitFigure,
  'shift-kpis.backlog': shiftKpisBacklogFigure,
  'shift-kpis.breakdown-map': shiftKpisBreakdownMapFigure,
};

/** Owner 67's reliability fit and critical-spares list, one figure on the machine page (67a). */
const reliabilityComputers: Readonly<Record<string, Computer>> = {
  reliability: reliabilityFigure,
};

/** Owner 39's figures: the registers and their splits, the cell change log, footprint, age and machine page. */
const registerComputers: Readonly<Record<string, Computer>> = {
  registers,
  'cell-change-log': cellChangeLog,
  'a7-footprint': footprint,
  'a8-age': ageAnalysis,
  'machine-page': machinePage,
};

/**
 * The computation of each figure, by key: the one map the engine runs. A registered figure with no entry here
 * answers `not_computed`, and the engine tickets from 38 to 45 add their files' maps to this one as they land.
 */
export const COMPUTERS: Readonly<Record<string, Computer>> = {
  ...dashboardComputers,
  ...registerComputers,
  ...breakdownComputers,
  ...manpowerComputers,
  ...compareComputers,
  ...forecastComputers,
  ...compareComputers,
  ...actionCenterComputers,
  ...reportComputers,
  ...shiftComputers,
  ...reliabilityComputers,
};
