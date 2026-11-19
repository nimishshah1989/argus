import type { BottleneckCore } from './a9-bottleneck.js';
import {
  episodesOf,
  quantile,
  quantileOfSorted,
  simulate,
  sortedAsc,
  type DrawModel,
  type Episode,
} from './a9-forecast-sim.js';
import { observedDayCount } from './availability.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, type SourcedReport } from './rows.js';
import type { MachineRow } from './types.js';

/**
 * The Forecast Lab's backtest (ticket 42, packet 42d): the tested months, each month's calendar cut, the four
 * methods' rates, the 1,000-run simulation and the pinball/coverage scores. The page and its verdicts live in
 * `forecast-lab.ts`; the file split is the hard 400-line budget, the same reason 42b split its own work. The
 * episode merge, the M0 model and the seeded draw order are 42b's and are reused, never copied.
 */

export const LAB_RUNS = 1000;
const DAY_MS = 86_400_000;
const SHORT_MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const purchaseDay = (machine: MachineRow): number | null =>
  machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));

/** The four methods the lab tests, in the key's order. */
export const METHOD_KEYS = ['M0', 'M1', 'M2', 'M3'] as const;
export type MethodKey = (typeof METHOD_KEYS)[number];
export type Scores = Record<MethodKey, MonthScore[]>;

export interface LabMonth {
  start: number;
  end: number;
  days: number;
  label: string;
}

export interface LabMachine {
  machine: MachineRow;
  category: string;
  t: number;
  episodes: Episode[];
  n: number;
  durations: number[];
}

type LabDraw = DrawModel & { id: string; expH: number };

type LabResult = { id: string; expH: number; p50: number; p80: number; p90: number };

interface LabRun {
  results: LabResult[];
  plant: { p10: number; p50: number; p80: number; p90: number };
}

/** One method's machine-month score, as the table and the aggregate read it. */
export interface MonthScore {
  n: number;
  loss: number;
  e80: number;
  e90: number;
  actual: number;
  inBand: boolean;
  cap: number | null;
  median: number;
  low: number;
  high: number;
}

/** A method over all tested months, averaged the way the key averages them. */
export interface Summary {
  loss: number;
  ex80: number;
  ex90: number;
  inBand: number;
  cap: number | null;
  machineMonths: number;
  range: number;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** The tested months: from the period start's fourth month through the last month that ended by the period end. */
export function monthsOf(from: string, toDay: number): LabMonth[] {
  const [year = 0, month = 1] = from.split('-').map(Number);
  const months: LabMonth[] = [];
  for (let index = year * 12 + month - 1 + 3; ; index += 1) {
    const y = Math.floor(index / 12);
    const m = index % 12;
    const start = Date.UTC(y, m, 1) / DAY_MS;
    const end = Date.UTC(y, m + 1, 0) / DAY_MS;
    if (end > toDay) break;
    months.push({
      start,
      end,
      days: new Date(end * DAY_MS).getUTCDate(),
      label: `${SHORT_MONTHS[m]} ${String(y).slice(2)}`,
    });
  }
  return months;
}

/** The month's base, in fleet order: machines bought strictly before the cut, observed from the later start, no gap month's days counted. */
export function baseOf(
  core: BottleneckCore,
  rows: readonly SourcedReport[],
  cut: number,
  periodStart: number,
): LabMachine[] {
  const cutRows = rows.filter((row) => {
    const day = dayNumber(row.report.date);
    return day !== null && day <= cut;
  });
  const episodes = episodesOf(cutRows);
  return core.fleet.flatMap((risk) => {
    const bought = purchaseDay(risk.machine);
    if (bought !== null && bought >= cut) return [];
    const start = Math.max(periodStart, bought ?? periodStart);
    const own = episodes.get(risk.machine.id) ?? [];
    return [
      {
        machine: risk.machine,
        category: risk.category,
        t: Math.max(1, observedDayCount(start, cut, core.noRecords)),
        episodes: own,
        n: own.length,
        durations: own.map((episode) => episode.hours),
      },
    ];
  });
}

/** The month's actual hours on its base machines, raw entries (no episode merge), start to end inclusive. */
export function actualOf(
  rows: readonly SourcedReport[],
  base: readonly LabMachine[],
  month: LabMonth,
): Map<string, number> {
  const inBase = new Set(base.map((machine) => machine.machine.id));
  const actual = new Map<string, number>();
  for (const row of rows) {
    if (!inBase.has(row.report.machineId)) continue;
    const day = dayNumber(row.report.date);
    if (day === null || day < month.start || day > month.end) continue;
    const id = row.report.machineId;
    actual.set(id, (actual.get(id) ?? 0) + effectiveHours(row.report));
  }
  return actual;
}

/** The draws' inputs: the category pool (or the fleet's), the cap, the mixture weight and the month's count. */
function drawModels(base: readonly LabMachine[], lam: readonly number[], days: number): LabDraw[] {
  const byCategory = new Map<string, number[]>();
  for (const machine of base) {
    const list = byCategory.get(machine.category) ?? [];
    list.push(...machine.durations);
    byCategory.set(machine.category, list);
  }
  const fleetDurations = base.flatMap((machine) => machine.durations);
  const caps = new Map<readonly number[], number>();
  return base.map((machine, index) => {
    const categoryDurations = byCategory.get(machine.category) ?? [];
    const pool = categoryDurations.length >= 15 ? categoryDurations : fleetDurations;
    let cap = caps.get(pool);
    if (cap === undefined) {
      cap = quantile(pool, 0.9);
      caps.set(pool, cap);
    }
    const capped = (values: readonly number[]): number =>
      values.length === 0 ? 0 : sum(values.map((hours) => Math.min(hours, cap))) / values.length;
    const w = machine.n / (machine.n + 4);
    const poolMean = capped(pool);
    const ownMean = machine.durations.length === 0 ? poolMean : capped(machine.durations);
    const expN = (lam[index] ?? 0) * days;
    return {
      id: machine.machine.id,
      own: machine.durations,
      pool,
      w,
      expN,
      expH: expN * (w * ownMean + (1 - w) * poolMean),
    };
  });
}

/** The month's simulation in the pinned order, with the plant's four percentiles. */
export function runMonth(
  base: readonly LabMachine[],
  lam: readonly number[],
  days: number,
): LabRun {
  const models = drawModels(base, lam, days);
  const { machine, plant } = simulate(models, LAB_RUNS);
  const results = models.map((model, index) => {
    const sims = sortedAsc(machine[index] ?? []);
    const p50 = quantileOfSorted(sims, 0.5);
    const p80 = Math.max(model.expH, quantileOfSorted(sims, 0.8));
    return {
      id: model.id,
      expH: model.expH,
      p50,
      p80,
      p90: Math.max(p80, quantileOfSorted(sims, 0.9)),
    };
  });
  const plantSorted = sortedAsc(plant);
  return {
    results,
    plant: {
      p10: quantileOfSorted(plantSorted, 0.1),
      p50: quantileOfSorted(plantSorted, 0.5),
      p80: quantileOfSorted(plantSorted, 0.8),
      p90: quantileOfSorted(plantSorted, 0.9),
    },
  };
}

/** The pinball losses at .5/.8/.9, the range coverage and the top-10 share for one machine-month. */
export function scoreMonth(run: LabRun, actual: ReadonlyMap<string, number>): MonthScore {
  const pin = (t: number, q: number, a: number): number =>
    a >= q ? t * (a - q) : (1 - t) * (q - a);
  let loss = 0;
  let actualTotal = 0;
  let e80 = 0;
  let e90 = 0;
  for (const row of run.results) {
    const a = actual.get(row.id) ?? 0;
    actualTotal += a;
    loss += (pin(0.5, row.p50, a) + pin(0.8, row.p80, a) + pin(0.9, row.p90, a)) / 3;
    if (a > row.p80) e80 += 1;
    if (a > row.p90) e90 += 1;
  }
  const ranked = [...run.results].sort((left, right) => right.expH - left.expH).slice(0, 10);
  const caught = sum(ranked.map((row) => actual.get(row.id) ?? 0));
  const ideal = sum(
    run.results
      .map((row) => actual.get(row.id) ?? 0)
      .sort((left, right) => right - left)
      .slice(0, 10),
  );
  const n = run.results.length;
  return {
    n,
    loss: n === 0 ? 0 : loss / n,
    e80,
    e90,
    actual: actualTotal,
    inBand: actualTotal >= run.plant.p10 && actualTotal <= run.plant.p90,
    cap: ideal > 0 ? caught / ideal : null,
    median: run.plant.p50,
    low: run.plant.p10,
    high: run.plant.p90,
  };
}

/** A method's months, averaged the way the key averages them. */
export function summarize(scores: readonly MonthScore[]): Summary {
  const machineMonths = sum(scores.map((score) => score.n));
  const average = (read: (score: MonthScore) => number): number =>
    scores.length === 0 ? 0 : sum(scores.map(read)) / scores.length;
  const caps = scores.flatMap((score) => (score.cap === null ? [] : [score.cap]));
  const ex80 = machineMonths > 0 ? sum(scores.map((score) => score.e80)) / machineMonths : 0;
  const ex90 = machineMonths > 0 ? sum(scores.map((score) => score.e90)) / machineMonths : 0;
  return {
    loss: average((score) => score.loss),
    ex80,
    ex90,
    inBand: scores.filter((score) => score.inBand).length,
    cap: caps.length === 0 ? null : sum(caps) / caps.length,
    machineMonths,
    range: Math.abs(ex80 - 0.2) + Math.abs(ex90 - 0.1),
  };
}
