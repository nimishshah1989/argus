import { isProduction } from './machine-facts.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { BottleneckCore, BottleneckRisk } from './a9-bottleneck.js';
import type { EngineData } from './types.js';

/**
 * The forecast's shared core (ticket 42, packet 42b): the episode merge 42b, 42c and 42d all read, the M0 rate the
 * A9 page uses, and the 2,000-draw simulation the Forecast Lab reuses. They share one file because the draw order
 * and the numbers it draws from are one subject, and because the file budget is a hard 400 lines.
 */

/** The runs the A9 planning forecast draws; the Forecast Lab re-seeds its own shorter run set. */
export const FC_RUNS = 2000;

/** The recent window every rate is compared over, and the prior the M0 rate shrinks toward. */
export const FC_WINDOW = 90;
export const FC_PRIOR_DAYS = 180;
/** A long breakdown, the one the long-duration mixture counts. */
const FC_LONG = 8;
const SEED = 1000;

/** One merged episode: the day it started, the day it ended and its hours. */
export interface Episode {
  first: number;
  last: number;
  hours: number;
}

/** The production breakdown rows: the fleet's, never PM (a NO-DT row still counts, with 0 h). */
export function fleetRows(data: EngineData): SourcedReport[] {
  const fleet = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return sourcedReports(data).filter((row) => fleet.has(row.report.machineId) && !isPm(row));
}

/** A machine's entries in date order: same or next calendar day merges into one episode, hours add, count once. */
function mergeEpisodes(list: readonly SourcedReport[]): Episode[] {
  const days = [...list].sort((left, right) => left.report.date.localeCompare(right.report.date));
  const merged: Episode[] = [];
  for (const row of days) {
    const day = dayNumber(row.report.date);
    if (day === null) continue;
    const last = merged.at(-1);
    if (last !== undefined && (day === last.last || day === last.last + 1)) {
      last.hours += effectiveHours(row.report);
      last.last = day;
    } else {
      merged.push({ first: day, last: day, hours: effectiveHours(row.report) });
    }
  }
  return merged;
}

/** Every machine's episodes, keyed by machine id. */
export function episodesOf(rows: readonly SourcedReport[]): Map<string, Episode[]> {
  const byMachine = new Map<string, SourcedReport[]>();
  for (const row of rows) {
    const list = byMachine.get(row.report.machineId) ?? [];
    list.push(row);
    byMachine.set(row.report.machineId, list);
  }
  return new Map([...byMachine].map(([id, list]) => [id, mergeEpisodes(list)]));
}

/** A category's episodes, days and durations, in base order; a machine's durations are its episodes' hours. */
export interface Group {
  episodes: number;
  days: number;
  durations: number[];
}

export function categoriesOf(
  core: BottleneckCore,
  episodes: Map<string, Episode[]>,
): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const risk of core.fleet) {
    const group = groups.get(risk.category) ?? { episodes: 0, days: 0, durations: [] };
    const own = episodes.get(risk.machine.id) ?? [];
    group.episodes += own.length;
    group.days += risk.days;
    group.durations.push(...own.map((episode) => episode.hours));
    groups.set(risk.category, group);
  }
  return groups;
}

/** The plan's quantile: the nearest rank, never interpolated, so two runs print the same number. */
export function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1) + 0.5)));
  return sorted[rank] ?? 0;
}

/** What a run draws from: a machine's own unsorted durations, the pool it falls back to, and its two weights. */
export interface DrawModel {
  own: number[];
  pool: number[];
  w: number;
  expN: number;
}

/** One machine's forecast model: the draws' inputs plus what the row prints from them. */
export interface ForecastModel extends DrawModel {
  risk: BottleneckRisk;
  episodes: Episode[];
  n: number;
  n90: number;
  lam: number;
  p1: number;
  pLong: number;
  expH: number;
  p80: number;
  p90: number;
}

/** What every model reads from the fleet: the rate it borrows, the pools it may draw and the window it forecasts. */
export interface ForecastInput {
  core: BottleneckCore;
  episodes: Map<string, Episode[]>;
  groups: Map<string, Group>;
  fleetDurations: number[];
  fleetRate: number;
  endDay: number;
  days: number;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

/** The share of a list's durations that count as long; a list with no durations has no share. */
const longShareOf = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.filter((hours) => hours >= FC_LONG).length / values.length;

/** The M0 rate: the machine's own count shrunk toward its category's rate (or the fleet's) with a 180-day prior. */
function rateOf(
  n: number,
  risk: BottleneckRisk,
  category: Group | undefined,
  fleetRate: number,
): number {
  const restDays = (category?.days ?? 0) - risk.days;
  const restEpisodes = (category?.episodes ?? 0) - n;
  const ownRate = restDays >= FC_PRIOR_DAYS ? restEpisodes / restDays : fleetRate;
  const lam0 = Math.max(ownRate, 0.25 * fleetRate);
  return (n + lam0 * FC_PRIOR_DAYS) / (risk.days + FC_PRIOR_DAYS);
}

/** The duration mixture: the machine's and its pool's capped means weighted by n/(n+4), and their long shares. */
function mixtureOf(own: readonly number[], pool: readonly number[], n: number, cap: number) {
  const capped = (values: readonly number[]): number =>
    mean(values.map((hours) => Math.min(hours, cap)));
  const w = n / (n + 4);
  const poolCapMean = capped(pool);
  const ownCap = own.length === 0 ? poolCapMean : capped(own);
  const share = w * longShareOf(own) + (1 - w) * longShareOf(pool);
  return { w, mu: w * ownCap + (1 - w) * poolCapMean, share };
}

/** The M0 model: the rate, the mixture and the two chances, before anything is simulated. */
export function modelOf(risk: BottleneckRisk, input: ForecastInput): ForecastModel {
  const episodes = input.episodes.get(risk.machine.id) ?? [];
  const own = episodes.map((episode) => episode.hours);
  const n = episodes.length;
  const category = input.groups.get(risk.category);
  const pool = (category?.episodes ?? 0) >= 15 ? (category?.durations ?? []) : input.fleetDurations;
  const lam = rateOf(n, risk, category, input.fleetRate);
  const expN = lam * input.days;
  const { w, mu, share } = mixtureOf(own, pool, n, quantile(pool, 0.9));
  return {
    risk,
    episodes,
    own,
    pool,
    n,
    n90: episodes.filter((episode) => episode.first > input.endDay - FC_WINDOW).length,
    lam,
    expN,
    w,
    p1: 1 - 1 / (1 + expN),
    pLong: 1 - 1 / (1 + expN * share),
    expH: expN * mu,
    p80: 0,
    p90: 0,
  };
}

/** mulberry32: one deterministic stream per machine, so the same workbook prints the same board. */
export function fcRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The platform's Poisson draw: Knuth below 30, a two-uniform rounded normal above, never negative. */
export function pois(rng: () => number, mean: number): number {
  if (mean < 30) {
    const limit = Math.exp(-mean);
    let count = 0;
    let product = 1;
    do {
      count += 1;
      product *= rng();
    } while (product > limit);
    return count - 1;
  }
  const z = Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
  return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
}

/**
 * The runs in the plan's exact draw order: per machine in base order, one uniform for the run's expected count, the
 * Poisson draw, then per breakdown one uniform for the mixture and one for the index into the machine's own unsorted
 * durations (or the pool's). Every machine's run k is added to the plant's run k.
 */
export function simulate(
  models: readonly DrawModel[],
  runs: number,
): { machine: number[][]; plant: number[] } {
  const machine: number[][] = [];
  const plant = new Array<number>(runs).fill(0);
  models.forEach((model, index) => {
    const rng = fcRng(SEED + index);
    const sims = new Array<number>(runs);
    for (let run = 0; run < runs; run += 1) {
      const g = -Math.log(rng() || 1e-9) * model.expN;
      const count = pois(rng, g);
      let total = 0;
      for (let breakdown = 0; breakdown < count; breakdown += 1) {
        const own = model.own.length > 0 && rng() < model.w;
        const pool = own ? model.own : model.pool;
        total += pool[Math.floor(rng() * pool.length)] ?? 0;
      }
      sims[run] = total;
      plant[run] = (plant[run] ?? 0) + total;
    }
    machine.push(sims);
  });
  return { machine, plant };
}

const LONG_MONTHS =
  'January February March April May June July August September October November December'.split(
    ' ',
  );

/** The month the planning forecast covers: the first full calendar month after the period end. */
export type Month = { label: string; days: number };

export function nextMonth(end: string): Month {
  const [year = 0, month = 1] = end.split('-').map(Number);
  const index = month % 12;
  const monthsYear = year + Math.floor(month / 12);
  const label = `${LONG_MONTHS[index]} ${monthsYear}`;
  return { label, days: new Date(Date.UTC(monthsYear, index + 1, 0)).getUTCDate() };
}

/** One planning forecast: the month it covers, every machine's model and the plant's summed runs. */
export interface ForecastBoard {
  month: Month;
  models: ForecastModel[];
  plant: number[];
}

/** The A9 board the forecast table and 42c's forecast chart print: M0's models and their 2,000 runs. */
export function forecastBoard(
  core: BottleneckCore,
  episodes: Map<string, Episode[]>,
  runs: number,
): ForecastBoard {
  const month = nextMonth(core.to);
  const fleetDurations = core.fleet.flatMap((risk) =>
    (episodes.get(risk.machine.id) ?? []).map((episode) => episode.hours),
  );
  const totalDays = core.fleet.reduce((total, risk) => total + risk.days, 0);
  const input: ForecastInput = {
    core,
    episodes,
    groups: categoriesOf(core, episodes),
    fleetDurations,
    fleetRate: totalDays > 0 ? fleetDurations.length / totalDays : 0,
    endDay: dayNumber(core.to) ?? 0,
    days: month.days,
  };
  const models = core.fleet.map((risk) => modelOf(risk, input));
  const { machine, plant } = simulate(models, runs);
  models.forEach((model, index) => {
    const sims = machine[index] ?? [];
    model.p80 = Math.max(model.expH, quantile(sims, 0.8));
    model.p90 = Math.max(model.p80, quantile(sims, 0.9));
  });
  return { month, models, plant };
}
