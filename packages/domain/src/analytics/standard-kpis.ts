import type { AnalyticsProfile } from '@uptimo/shared';
import { hoursIn, yearToDate } from './availability.js';
import { formatInr } from './format.js';
import { isProduction } from './machine-facts.js';
import {
  effectiveHours,
  isHistory,
  isNoDowntime,
  isPm,
  sourcedReports,
  type SourcedReport,
} from './rows.js';
import { workingHoursPlant } from './working-hours.js';
import type { Computer, EngineData, FigureValue, ReportRow, TicketRow } from './types.js';

/**
 * The standard (working-hours) family (ticket 48, R3-R7): the same rows as the platform's figures, divided by the
 * plant's own shift calendar instead of the workbook's 20 x 300. The comparison prints the platform's frozen
 * column beside this one and never replaces it; `legacyTotals` computes that column with the legacy rules exactly
 * (`effectiveHours`, the flat annual hours) so its five cells are A1's and A3's own printed cells.
 */

const DASH = '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHIFT_ALIASES: Record<string, string> = { '1ST': '1', '2ND': '2' };

/** One report that counts as a failure under the standard definition, with the lost time it really recorded. */
export interface FailureEvent {
  report: ReportRow;
  ticket: TicketRow;
  /** Exact recorded minutes, zero for a NO DT entry (the plant attended it outside production hours). */
  minutes: number;
  /** The same in hours: the standard MTTR's numerator. */
  hours: number;
}

/** The five measures and their two bases, one shape for both columns of the comparison. */
export interface KpiTotals {
  workingHours: number | null;
  breakdownHours: number;
  pmHours: number;
  failures: number;
  mttr: number | null;
  mtbf: number | null;
  /** A fraction (0.9936), never points: the figure prints it as a percentage. */
  availability: number | null;
  /** A fraction of working hours (0.0051), never points. */
  bdPct: number | null;
  pmPct: number | null;
  machines: number;
  machinesWithoutFailure: number;
}

/**
 * A report's shift as the settings spell it: `1ST` and `2ND` are shift 1 and shift 2 (R8). The shift split groups by
 * this same key, so a row cannot count in one shift for one figure and another shift for the other.
 */
export function shiftKey(report: ReportRow): string {
  const raw = report.shift.trim().toUpperCase();
  return SHIFT_ALIASES[raw] ?? raw;
}

/** DATA-MAP section 2's own pair: machine, date, shift and downtime together. */
const reportKey = (report: ReportRow): string =>
  `${report.machineId}|${report.date}|${shiftKey(report)}|${report.downtimeMin}`;

/**
 * The failure set (R4): a non-PM report of a `stopped` ticket that is closed, on a production machine, history or
 * live. A live report whose four fields exactly equal a history report's is the same failure and drops; a same-day
 * repeat whose downtime differs is a real second failure. NO DT keeps its place with zero lost time. The kind is the
 * breakdown test: support, a PM job and a general work request are not failures, while every imported history row
 * (which `isBreakdownChannel` would wrongly drop) stays in.
 */
export function failureEvents(data: EngineData): FailureEvent[] {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  const rows = sourcedReports(data).filter(
    (row) =>
      production.has(row.report.machineId) &&
      row.ticket.kind === 'stopped' &&
      row.ticket.status === 'closed' &&
      !isPm(row),
  );
  const historyKeys = new Set(rows.filter(isHistory).map((row) => reportKey(row.report)));
  return rows.flatMap((row) => {
    if (!isHistory(row) && historyKeys.has(reportKey(row.report))) return [];
    const minutes = isNoDowntime(row) ? 0 : Math.max(0, row.report.downtimeMin);
    return [{ report: row.report, ticket: row.ticket, minutes, hours: minutes / 60 }];
  });
}

/** Exact recorded minutes as hours; a NO DT row's recorded time is not lost time. */
const standardHours = (row: SourcedReport): number =>
  isNoDowntime(row) ? 0 : Math.max(0, row.report.downtimeMin) / 60;

/** The three share rows of one column, from its totals: a null basis has no quotient to print. */
function totalsOf(parts: {
  workingHours: number | null;
  breakdownHours: number;
  pmHours: number;
  failures: number;
  machines: number;
  machinesWithoutFailure: number;
}): KpiTotals {
  const { workingHours, breakdownHours, pmHours, failures } = parts;
  const quotient = (part: number): number | null =>
    workingHours !== null && workingHours > 0 ? part / workingHours : null;
  return {
    ...parts,
    mttr: failures > 0 ? breakdownHours / failures : null,
    mtbf: workingHours !== null && failures > 0 ? (workingHours - breakdownHours) / failures : null,
    availability:
      workingHours !== null && workingHours > 0
        ? 1 - (breakdownHours + pmHours) / workingHours
        : null,
    bdPct: quotient(breakdownHours),
    pmPct: quotient(pmHours),
  };
}

/**
 * The platform's column, with the platform's own rules: history rows only (a live close is invisible to it), the
 * workbook's recorded hours (`effectiveHours`, NO DT at zero) and the flat annual hours `prodHrsPerDay x days`.
 * Its hours cover the run's span, with no-records months left out, or the as-of year to date when no span is named.
 * Only in that no-span case are its five cells A1's and A3's own printed cells rather than a retyped copy.
 */
export function legacyTotals(data: EngineData, profile: AnalyticsProfile, asOf: string): KpiTotals {
  const machines = data.machines.filter(isProduction);
  const ids = new Set(machines.map((machine) => machine.id));
  const window = data.period ?? yearToDate(asOf);
  const annual = profile.prodHrsPerDay * profile.workDaysPerYear;
  const workingHours = machines.reduce((sum, machine) => sum + hoursIn(machine, annual, window), 0);
  const history = sourcedReports(data).filter(
    (row) => isHistory(row) && ids.has(row.report.machineId) && row.report.date <= asOf,
  );
  const breakdowns = history.filter((row) => !isPm(row));
  const pms = history.filter(isPm);
  const failed = new Set(breakdowns.map((row) => row.report.machineId));
  const breakdownHours = breakdowns.reduce((sum, row) => sum + effectiveHours(row.report), 0);
  const pmHours = pms.reduce((sum, row) => sum + effectiveHours(row.report), 0);
  return totalsOf({
    workingHours,
    breakdownHours,
    pmHours,
    failures: breakdowns.length,
    machines: machines.length,
    machinesWithoutFailure: machines.filter((machine) => !failed.has(machine.id)).length,
  });
}

/** The events at or before the run date, on the production fleet the figure reads. */
function eventsAt(data: EngineData, asOf: string): FailureEvent[] {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return failureEvents(data).filter(
    (event) => event.report.date <= asOf && production.has(event.report.machineId),
  );
}

/**
 * The working-hours column (R5-R7): the failure set above, exact minutes, and the plant's shift calendar as the
 * denominator. No active shift window leaves `workingHours` null and the four basis-dependent measures null; MTTR
 * still reads, because it needs no denominator. A machine with no failure has no MTBF of its own and is counted,
 * not given its whole window.
 */
export function standardTotals(
  data: EngineData,
  profile: AnalyticsProfile,
  asOf: string,
): KpiTotals {
  const plant = workingHoursPlant(data, profile, asOf);
  const ids = new Set(plant.machines.map((machine) => machine.id));
  const events = eventsAt(data, asOf);
  const pmRows = sourcedReports(data).filter(
    (row) =>
      isPm(row) &&
      row.ticket.status === 'closed' &&
      row.report.date <= asOf &&
      ids.has(row.report.machineId),
  );
  const failed = new Set(events.map((event) => event.report.machineId));
  return totalsOf({
    workingHours: plant.hours,
    breakdownHours: events.reduce((sum, event) => sum + event.hours, 0),
    pmHours: pmRows.reduce((sum, row) => sum + standardHours(row), 0),
    failures: events.length,
    machines: plant.machines.length,
    machinesWithoutFailure: plant.machines.filter((machine) => !failed.has(machine.id)).length,
  });
}

interface PageKpi {
  label: string;
  value: string;
  sub: string;
}

interface PageTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

/** The four KPI facts, or the one honest line a plant with no shift window reads instead. */
function compareKpis(
  plant: ReturnType<typeof workingHoursPlant>,
  standard: KpiTotals,
  asOf: string,
): PageKpi[] {
  if (plant.minutesPerDay === 0) {
    return [
      {
        label: 'No shift windows in Settings',
        value: DASH,
        sub: 'the platform column still prints',
      },
    ];
  }
  const [year, month, day] = asOf.split('-').map(Number) as [number, number, number];
  return [
    {
      label: 'Working Hours / Day',
      value: formatInr(plant.minutesPerDay / 60, 1),
      sub: 'the plant’s active shift windows',
    },
    {
      label: 'Working Hours',
      value: formatInr(standard.workingHours ?? 0, 2),
      sub: `to ${day} ${MONTHS[month - 1]} ${year} · ${formatInr(plant.annualHours, 0)} a machine a year`,
    },
    {
      label: 'Failures',
      value: formatInr(standard.failures, 0),
      sub: 'non-PM breakdowns, history and live',
    },
    {
      label: 'Machines Without a Failure',
      value: formatInr(standard.machinesWithoutFailure, 0),
      sub: `${formatInr(standard.machines, 0)} machines in production data`,
    },
  ];
}

const measure = (value: number | null, decimals: number): string =>
  value === null ? DASH : formatInr(value, decimals);
const share = (value: number | null): string => (value === null ? DASH : formatInr(value * 100, 2));

/** The platform's column beside the working-hours column: the one table the first figure prints. */
function compareTable(legacy: KpiTotals, standard: KpiTotals): PageTable {
  const rows = [
    ['MTBF (hours)', measure(legacy.mtbf, 1), measure(standard.mtbf, 1)],
    ['MTTR (hours)', measure(legacy.mttr, 2), measure(standard.mttr, 2)],
    ['Availability (%)', share(legacy.availability), share(standard.availability)],
    ['Breakdown %', share(legacy.bdPct), share(standard.bdPct)],
    ['PM %', share(legacy.pmPct), share(standard.pmPct)],
  ];
  return {
    title: 'The platform basis beside the working-hour basis',
    header: ['Measure', 'Platform basis', 'Working-hour basis'],
    rows,
    rowCount: rows.length,
  };
}

/**
 * The comparison figure: the platform's five cells beside the standard five, with the basis stated as its own
 * block so a later ticket reads a number instead of a formatted cell. An empty fleet or no failure prints nothing;
 * a plant with no shift window still prints, its four basis-dependent cells dashed (R3).
 */
export const shiftKpisCompareFigure: Computer = ({ data, asOf, profile }) => {
  const plant = workingHoursPlant(data, profile, asOf);
  const legacy = legacyTotals(data, profile, asOf);
  const standard = standardTotals(data, profile, asOf);
  if (plant.machines.length === 0 || standard.failures === 0) return { value: null, drillIds: [] };
  const value = {
    screen: 'shift-kpis',
    asOf,
    basis: {
      legacy,
      standard,
      minutesPerDay: plant.minutesPerDay,
      annualHours: plant.annualHours,
    },
    pages: [
      {
        page: 'shift-kpis',
        title: 'Shift-calendar KPIs',
        kpis: compareKpis(plant, standard, asOf),
        tables: [compareTable(legacy, standard)],
        charts: [],
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: eventsAt(data, asOf).map((event) => event.ticket.id),
  };
};
