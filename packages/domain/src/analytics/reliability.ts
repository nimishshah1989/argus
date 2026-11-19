import type { AnalyticsProfile } from '@uptimo/shared';
import { availabilityWindow } from './availability.js';
import { partsOf, spareDrill, sparesBlock, type SpareRow } from './critical-spares.js';
import { isProduction } from './machine-facts.js';
import { amsaaOf, kmOf, weibullOf, type Quartiles, type Trend } from './reliability-maths.js';
import { failureEvents, type FailureEvent } from './standard-kpis.js';
import { workingHoursFor, workingMinutesPerDay } from './working-hours.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

export { amsaaOf, kmOf, weibullOf } from './reliability-maths.js';
export type {
  KmFit,
  KmStep,
  Quartiles,
  Trend,
  TrendLabel,
  WeibullFit,
} from './reliability-maths.js';
export type { SpareRow };

/**
 * The reliability fit (ticket 67, R1-R4, R6, R11-R13): 48's failure set read as one event a failure date, the
 * plant's month-spread working hours as the clock, the estimators from `reliability-maths.ts` on those
 * observations, and the block a machine page reads. Plain TypeScript: no statistics package, no new dependency.
 */

/** A basis is fit-ready with five events and four complete intervals: the smallest sample one interval cannot own. */
const MIN_EVENTS = 5;
const MIN_INTERVALS = 4;

/** The number fields every fitted block and category pool carries: the Weibull, its sample and its two checks. */
export interface FitNumbers {
  shape: number;
  scale: number;
  meanHours: number;
  events: number;
  completeIntervals: number;
  /** The tail at asOf; a category's is the sum of its machines' tails. */
  censoredHours: number;
  quartiles: Quartiles;
  trend: Trend;
}

export type FitBlock =
  | ({
      status: 'fitted';
      basis: 'machine' | 'category';
      category: string | null;
      ownEvents: number;
    } & FitNumbers)
  | {
      status: 'insufficient';
      ownEvents: number;
      category: string | null;
      categoryEvents: number;
      minimum: number;
    }
  | { status: 'no_basis' };

export interface MachineReliability {
  fit: FitBlock;
  spares: { rows: SpareRow[]; total: number };
  /** The machine's own report tickets behind the fit and behind the listed parts (R13). */
  drill: { fit: string[]; spares: string[] };
}

/** One fit-ready category, pooled across its machines: the fallback a small machine reads. */
export interface CategoryFit extends FitNumbers {
  /** The category's machines with at least one failure event: their tails are in the likelihood. */
  machines: number;
}

export interface ReliabilityValue {
  asOf: string;
  windowStart: string;
  minimumEvents: number;
  machines: Record<string, MachineReliability>;
  categories: Record<string, CategoryFit>;
}

/** The trimmed category label; null for a machine with none, which cannot fall back to a category fit. */
const categoryOf = (machine: MachineRow): string | null => {
  const label = machine.category?.trim() ?? '';
  return label === '' ? null : label;
};

/** One machine's observations: its events, the working hours at each date and the tail to the run date. */
interface Basis {
  machine: MachineRow;
  events: FailureEvent[];
  dates: string[];
  /** `H(d_i)` for each date; the intervals compose to `H(last) - H(first)`. */
  endpoints: number[];
  complete: number[];
  censored: number;
  hoursToAsOf: number;
}

interface PlantInputs {
  windowStart: string;
  /** False when the plant has no active shift window: there is no working-hours basis to fit (R6). */
  hasBasis: boolean;
  bases: Basis[];
  categories: Map<string, Basis[]>;
  /** Every category's pooled event count, fit-ready or not: the "not enough history" line prints it. */
  categoryEvents: Map<string, number>;
}

/**
 * The fit's inputs (R2-R4): 48's `failureEvents`, filtered to the window, grouped into one event a failure date;
 * `H(d)` is `workingHoursFor` from 1 January, the month-spread clock MTBF divides by. The leading interval from the
 * window start to a machine's first failure is not an observation: 1 January is not a renewal point.
 */
function inputsOf(data: EngineData, asOf: string, profile: AnalyticsProfile): PlantInputs {
  const windowStart = availabilityWindow(asOf, asOf).from;
  const shifts = data.shifts ?? [];
  const byMachine = new Map<string, FailureEvent[]>();
  for (const event of failureEvents(data)) {
    if (event.report.date < windowStart || event.report.date > asOf) continue;
    const rows = byMachine.get(event.report.machineId) ?? [];
    rows.push(event);
    byMachine.set(event.report.machineId, rows);
  }
  const bases: Basis[] = [];
  const categories = new Map<string, Basis[]>();
  const categoryEvents = new Map<string, number>();
  for (const machine of data.machines.filter(isProduction)) {
    const events = byMachine.get(machine.id) ?? [];
    const dates = [...new Set(events.map((event) => event.report.date))].sort();
    const hours = (date: string): number =>
      workingHoursFor(machine, shifts, profile.workDaysPerYear, { from: windowStart, to: date });
    const endpoints = dates.map(hours);
    const hoursToAsOf = dates.length > 0 ? hours(asOf) : 0;
    const basis: Basis = {
      machine,
      events,
      dates,
      endpoints,
      complete: endpoints
        .slice(1)
        .map((value, index) => value - endpoints[index]!)
        .filter((value) => value > 0),
      censored: Math.max(0, hoursToAsOf - (endpoints.at(-1) ?? 0)),
      hoursToAsOf,
    };
    bases.push(basis);
  }
  poolCategories(bases, categories, categoryEvents);
  return {
    windowStart,
    hasBasis: workingMinutesPerDay(shifts).total > 0,
    bases,
    categories,
    categoryEvents,
  };
}

/** Pool the bases by their trimmed category label, and count each category's events, fit-ready or not. */
function poolCategories(
  bases: readonly Basis[],
  categories: Map<string, Basis[]>,
  categoryEvents: Map<string, number>,
): void {
  for (const basis of bases) {
    const label = categoryOf(basis.machine);
    if (label === null) continue;
    categories.set(label, [...(categories.get(label) ?? []), basis]);
    if (basis.dates.length > 0) {
      categoryEvents.set(label, (categoryEvents.get(label) ?? 0) + basis.dates.length);
    }
  }
}

/** A Weibull fit as the block's number fields: the mean is the fit's, the sample and checks are the caller's. */
const fitNumbers = (
  fit: { shape: number; scale: number; mean: number },
  sample: { events: number; completeIntervals: number; censoredHours: number },
  checks: { quartiles: Quartiles; trend: Trend },
): FitNumbers => ({
  shape: fit.shape,
  scale: fit.scale,
  meanHours: fit.mean,
  ...sample,
  ...checks,
});

/** One fit-ready category's pooled fit, or null when the pool has fewer than five events or four intervals. */
function categoryFit(bases: readonly Basis[]): CategoryFit | null {
  const withEvents = bases.filter((basis) => basis.dates.length > 0);
  const complete = bases.flatMap((basis) => basis.complete);
  const events = withEvents.reduce((sum, basis) => sum + basis.dates.length, 0);
  if (events < MIN_EVENTS || complete.length < MIN_INTERVALS) return null;
  const tails = withEvents.map((basis) => basis.censored);
  const fit = weibullOf(complete, tails);
  return {
    ...fitNumbers(
      fit,
      {
        events,
        completeIntervals: complete.length,
        censoredHours: tails.reduce((sum, tail) => sum + tail, 0),
      },
      {
        quartiles: kmOf(complete, tails).quartiles,
        trend: amsaaOf(
          withEvents.map((basis) => ({ times: basis.endpoints, end: basis.hoursToAsOf })),
        ),
      },
    ),
    machines: withEvents.length,
  };
}

/** The machine's own report tickets, in date order: the fit's drill names every report behind its events. */
function eventTickets(events: readonly FailureEvent[]): string[] {
  const ordered = [...events].sort(
    (left, right) =>
      left.report.date.localeCompare(right.report.date) ||
      left.report.id.localeCompare(right.report.id),
  );
  return [...new Set(ordered.map((event) => event.ticket.id))];
}

/** The block a machine reads: its own fit, its category's, "not enough history", or no basis at all (R6). */
function fitBlock(
  basis: Basis,
  categoryBlock: CategoryFit | undefined,
  plant: Pick<PlantInputs, 'hasBasis' | 'categoryEvents'>,
): FitBlock {
  const category = categoryOf(basis.machine);
  if (!plant.hasBasis) return { status: 'no_basis' };
  const ownEvents = basis.dates.length;
  if (ownEvents >= MIN_EVENTS && basis.complete.length >= MIN_INTERVALS) {
    const numbers = fitNumbers(
      weibullOf(basis.complete, [basis.censored]),
      {
        events: ownEvents,
        completeIntervals: basis.complete.length,
        censoredHours: basis.censored,
      },
      {
        quartiles: kmOf(basis.complete, [basis.censored]).quartiles,
        trend: amsaaOf([{ times: basis.endpoints, end: basis.hoursToAsOf }]),
      },
    );
    return { status: 'fitted', basis: 'machine', category, ownEvents, ...numbers };
  }
  if (categoryBlock !== undefined) {
    return { status: 'fitted', basis: 'category', category, ownEvents, ...categoryBlock };
  }
  return {
    status: 'insufficient',
    ownEvents,
    category,
    categoryEvents: category === null ? 0 : (plant.categoryEvents.get(category) ?? 0),
    minimum: MIN_EVENTS,
  };
}

/**
 * The reliability figure (R11): one `MachineReliability` per production machine and one `CategoryFit` per fit-ready
 * category, keyed by machine id and the trimmed category label. The figure's own drill is the 125 production
 * machines; a block's drills stay that machine's own reports. A plant with no production machine prints nothing.
 */
export const reliabilityFigure: Computer = ({ data, asOf, profile }) => {
  const production = data.machines.filter(isProduction);
  if (production.length === 0) return { value: null, drillIds: [] };
  const inputs = inputsOf(data, asOf, profile);
  const categories: Record<string, CategoryFit> = {};
  for (const [label, bases] of inputs.categories) {
    const fit = categoryFit(bases);
    if (fit !== null) categories[label] = fit;
  }
  const machines: Record<string, MachineReliability> = {};
  for (const basis of inputs.bases) {
    const category = categoryOf(basis.machine);
    const parts = partsOf(basis.events);
    machines[basis.machine.id] = {
      fit: fitBlock(basis, category === null ? undefined : categories[category], inputs),
      spares: sparesBlock(parts),
      drill: { fit: eventTickets(basis.events), spares: spareDrill(parts) },
    };
  }
  const value: ReliabilityValue = {
    asOf,
    windowStart: inputs.windowStart,
    minimumEvents: MIN_EVENTS,
    machines,
    categories,
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: production.map((machine) => machine.id),
  };
};
