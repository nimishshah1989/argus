import { availableHours, availabilityWindow, daysInclusive } from './availability.js';
import type { Computer, EngineData, MachineRow, ReportRow, TicketRow } from './types.js';

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

/** A breakdown report with the ticket that says which log it came from: a report carries no source of its own. */
interface SourcedReport {
  report: ReportRow;
  ticket: TicketRow;
}

/** Every report whose ticket is in the snapshot, so its source resolves; an unlinked report has no source. */
function sourcedReports(data: EngineData): SourcedReport[] {
  const tickets = new Map([...data.tickets, ...data.tasks].map((ticket) => [ticket.id, ticket]));
  return data.reports.flatMap((report) => {
    const ticket = report.ticketId === null ? undefined : tickets.get(report.ticketId);
    return ticket ? [{ report, ticket }] : [];
  });
}

const isPm = (row: SourcedReport): boolean => row.report.maintCode === 'PM';
const isNoDowntime = (row: SourcedReport): boolean => row.report.maintCode === 'NO DT';
const isHistory = (row: SourcedReport): boolean => row.ticket.source === 'history';

/**
 * The actual-breakdown rows: PM work is not a breakdown, and a NO-DT row records breakdown hours but no downtime,
 * so it keeps its own figure and stays out of the downtime totals (the key's sub-label says so).
 */
const isDowntime = (row: SourcedReport): boolean => !isPm(row) && !isNoDowntime(row);

/** The ticket ids behind a figure; each sourced report's ticket is in the snapshot, so every id drills. */
const ticketIds = (rows: readonly SourcedReport[]): string[] => rows.map((row) => row.ticket.id);

const minutes = (rows: readonly SourcedReport[]): number =>
  rows.reduce((sum, row) => sum + row.report.downtimeMin, 0);

/** The key prints hours to one decimal and the average to two: round to the key's own decimals, half up. */
const round = (value: number, decimals: 1 | 2): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const hours = (rows: readonly SourcedReport[]): number => round(minutes(rows) / 60, 1);

/** A CNC machine the plant counts in production data: the Robot and any Settings exclusion are left out. */
const isProduction = (machine: MachineRow): boolean =>
  machine.segment === 'CNC' && !machine.excludedFromProduction;

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
    const counted = sourcedReports(data).filter((row) => isHistory(row) && !isPm(row));
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
};

/**
 * The computation of each figure, by key: the one map the engine runs. A registered figure with no entry here
 * answers `not_computed`, and the engine tickets from 38 to 45 add their files' maps to this one as they land.
 */
export const COMPUTERS: Readonly<Record<string, Computer>> = { ...dashboardComputers };
