import type { AnalyticsProfile } from '@uptimo/shared';
import { dataAsOf } from './as-of.js';
import { gapMonths, recordedMonths, type Period } from './availability.js';
import { COMPUTERS } from './computers.js';
import { FIGURES, type FigureDef } from './registry.js';
import { listedExclusions, withListedExclusions } from './machine-facts.js';
import { isHistory, logNumbers, sourcedReports } from './rows.js';
import type {
  Computed,
  Computer,
  EngineData,
  EngineResult,
  FigureResult,
  FigureValue,
} from './types.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A plant date the calendar has: `2026-02-30` and `2026-13-01` are not. */
function isPlantDate(day: string): boolean {
  if (!DAY.test(day)) return false;
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, date));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === date
  );
}

/** The span a caller names: plant dates, both ends included. */
type Span = Pick<Period, 'from' | 'to'>;

/** The ids of the rows of each drill type, so a figure can be checked against the rows it was given. */
function knownIds(data: EngineData): Record<FigureDef['drill'], Set<string>> {
  return {
    machine: new Set(data.machines.map((row) => row.id)),
    ticket: new Set([...data.tickets, ...data.tasks].map((row) => row.id)),
    move: new Set(data.moves.map((row) => row.id)),
  };
}

/** A value that has no rows behind it: nothing, zero, an empty text, or a list or object of empties. */
function isEmptyValue(value: FigureValue): boolean {
  if (value === null || value === 0 || value === '' || value === false) return true;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyValue);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(isEmptyValue);
}

/**
 * A computed figure must name the rows it came from, and every one of them must be a row of its drill type in the
 * data it was computed from. It may name none only when its value is empty or zero. A figure that cannot say where
 * it came from is a bug in the engine, not a value to show.
 */
function drillOf(def: FigureDef, computed: Computed, known: Set<string>): string[] {
  const ids = [...new Set(computed.drillIds)].sort();
  const stray = ids.find((id) => !known.has(id));
  if (stray !== undefined) {
    throw new Error(
      `Figure ${def.key} drills to ${stray}, which is not a ${def.drill} row of its data`,
    );
  }
  if (ids.length === 0 && def.mixed !== true && !isEmptyValue(computed.value)) {
    throw new Error(`Figure ${def.key} has a value but names no rows to drill to`);
  }
  return ids;
}

const monthOf = (day: string): string => day.slice(0, 7);

/** A month is over once the run date is its last day; only an over month with no record is a gap in the log. */
const monthIsOver = (asOf: string): boolean =>
  Number(asOf.slice(8)) ===
  new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)), 0)).getUTCDate();

/** The months the plant recorded nothing in, first record to the run date: the month still running is not one. */
function plantGaps(data: EngineData, asOf: string): string[] {
  return gapMonths(data, asOf).filter((key) => key !== monthOf(asOf) || monthIsOver(asOf));
}

/**
 * The span a run reads: never past the run date, never before the plant's first recorded month (the empty years
 * before it are not available hours; `requestedFrom` says what was asked), with the gap months inside it.
 */
function periodOf(span: Span, asOf: string, data: EngineData, gaps: readonly string[]): Period {
  if (!isPlantDate(span.from) || !isPlantDate(span.to) || span.from > span.to) {
    throw new RangeError(
      `span must run from one plant date to a later one, got ${span.from} to ${span.to}`,
    );
  }
  if (span.from > asOf) throw new RangeError(`span starts after asOf ${asOf}: ${span.from}`);
  const first = [...recordedMonths(data, asOf)].sort()[0];
  const floor = first === undefined ? span.from : `${first}-01`;
  const from = span.from > floor ? span.from : floor;
  const to = span.to < asOf ? span.to : asOf;
  const noRecords = gaps.filter((key) => key >= monthOf(from) && key <= monthOf(to));
  return { from, to, noRecords, ...(from === span.from ? {} : { requestedFrom: span.from }) };
}

/**
 * The reports with each history row's log number written on it, counted over the whole history before any cut: the
 * loader stores none, and a span that numbered its own rows would start again at 1.
 */
function numbered(data: EngineData): EngineData['reports'] {
  const rows = sourcedReports(data).filter(isHistory);
  const numbers = logNumbers(rows);
  const byReport = new Map(rows.map((row, index) => [row.report.id, numbers[index]!]));
  return data.reports.map((report) => {
    const srNo = byReport.get(report.id);
    return srNo === undefined ? report : { ...report, srNo };
  });
}

/** What a figure that reads the span sees: the plant cut to it. Tickets stay, so a breakdown closed after `to` counts. */
function cutToPeriod(data: EngineData, period: Period): EngineData {
  return {
    ...data,
    machines: data.machines.filter((m) => m.purchasedOn === null || m.purchasedOn <= period.to),
    moves: data.moves.filter((move) => move.effectiveFrom <= period.to),
    reports: numbered(data).filter((r) => r.date >= period.from && r.date <= period.to),
  };
}

/**
 * The two views of one run. With no span a figure sees the as-of plant exactly as before, no period and no gap month.
 * With one, every figure carries the period and the plant's gap list; those that read the span see it cut, as of its end.
 */
function viewsOf(data: EngineData, asOf: string, span?: Span) {
  if (!span) return { whole: data, cut: data, cutAsOf: asOf, period: undefined };
  const gaps = plantGaps(data, asOf);
  const period = periodOf(span, asOf, data, gaps);
  const whole = { ...data, period, gaps };
  return { whole, cut: cutToPeriod(whole, period), cutAsOf: period.to, period };
}

/**
 * The engine with a given set of computations: the one test seam. Pure and deterministic: the same data, date
 * and profile always give the same figures, in registry order, and nothing reads the clock or the database.
 */
export function runWith(
  computers: Readonly<Record<string, Computer>>,
  input: { data: EngineData; asOf: string; profile: AnalyticsProfile; span?: Span },
): EngineResult {
  const { asOf, profile } = input;
  if (!isPlantDate(asOf))
    throw new RangeError(`asOf must be a plant date like 2026-11-11, got ${asOf}`);
  const data = dataAsOf(withListedExclusions(input.data), asOf);
  const known = knownIds(data);
  const views = viewsOf(data, asOf, input.span);
  const figures = FIGURES.map((def): FigureResult => {
    const base = { key: def.key, screen: def.screen, owner: def.owner };
    const compute = computers[def.key];
    if (!compute) {
      return { ...base, status: 'not_computed', value: null, drill: { type: def.drill, ids: [] } };
    }
    const computed =
      def.reads === undefined
        ? compute({ data: views.cut, asOf: views.cutAsOf, profile })
        : compute({ data: views.whole, asOf, profile });
    const ids = drillOf(def, computed, known[def.drill]);
    return { ...base, status: 'ready', value: computed.value, drill: { type: def.drill, ids } };
  });
  const rows = {
    machines: data.machines.length,
    moves: data.moves.length,
    tickets: data.tickets.length,
    tasks: data.tasks.length,
    reports: data.reports.length,
    people: data.people.length,
  };
  const excludedMachines = listedExclusions(data);
  return {
    asOf,
    profile,
    rows,
    excludedMachines,
    figures,
    ...(views.period ? { period: views.period } : {}),
  };
}

/**
 * `run(data, asOf, profile, span?)`: the figures of the plant as of one plant date, for the span named or, with none,
 * for the as-of year to date with no gap month.
 */
export function run(
  data: EngineData,
  asOf: string,
  profile: AnalyticsProfile,
  span?: Span,
): EngineResult {
  return runWith(COMPUTERS, { data, asOf, profile, span });
}
