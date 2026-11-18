import { type BottleneckRisk } from './a9-bottleneck.js';
import { fleetRows } from './a9-forecast-sim.js';
import { normalizeLabel } from './format.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, type SourcedReport } from './rows.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * The age-adjusted health score behind Team Focus's "overhaul or replace" lane (ticket 43, packet 43b). It is the
 * platform's own score (Guide section 24): a category rate times an age-band factor, fitted to the plant; a machine's
 * counts and hours against that expectation, its repair time, its recent trend and its repeat faults, weighted.
 * The lane only reads the label and the expected hours; the full scorecard is the Compare packet's page.
 */

const BANDS = [3, 6, 10, 15] as const;
const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** The machine's purchase day as a plant-day number, or null when no readable purchase date is known. */
function purchaseDayOf(machine: MachineRow): number | null {
  return machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));
}

/** The health score's age band; an unknown or future purchase date is outside every band. */
function ageBand(age: number | null): number {
  if (age === null || age < 0) return -1;
  for (let index = 0; index < BANDS.length; index += 1) if (age < BANDS[index]!) return index;
  return BANDS.length;
}

/** One machine's health-model seed: what it did in its observed years and the age band it belongs to. */
interface Seed {
  readonly cat: string;
  readonly yrs: number;
  readonly band: number;
  readonly n: number;
  readonly h: number;
}

/** The shrunk multiplicative fit: a category rate times an age-band factor, iterated to a fixed point. */
interface Fit {
  readonly c: Readonly<Record<string, number>>;
  readonly a: readonly number[];
  readonly r0: number;
}

/** The fit's working state: the rows, the key it counts and the rates it is iterating. */
interface FitState {
  readonly used: readonly Seed[];
  readonly key: 'n' | 'h';
  readonly K: number;
  readonly c: Record<string, number>;
  readonly a: number[];
  readonly r0: number;
}

/** One iteration's category rates: a category's observed events over its age-weighted exposure. */
function fitCategories(state: FitState): void {
  for (const cat of Object.keys(state.c)) {
    const own = state.used.filter((row) => row.cat === cat);
    state.c[cat] =
      (sum(own.map((row) => row[state.key])) + state.K) /
      (sum(own.map((row) => row.yrs * (row.band >= 0 ? state.a[row.band]! : 1))) +
        state.K / state.r0);
  }
}

/** One iteration's age-band factors: an observed band over its category-weighted exposure. */
function fitBands(state: FitState): void {
  for (let band = 0; band < 5; band += 1) {
    const own = state.used.filter((row) => row.band === band);
    state.a[band] =
      own.length === 0
        ? 1
        : (sum(own.map((row) => row[state.key])) + state.K) /
          (sum(own.map((row) => row.yrs * (state.c[row.cat] ?? state.r0))) + state.K);
  }
}

/** Pull the factors back to a weighted mean of one, so the category level carries the plant's rate. */
function normaliseFit(state: FitState): void {
  const banded = state.used.filter((row) => row.band >= 0);
  const mean =
    sum(banded.map((row) => row.yrs * state.a[row.band]!)) /
      (sum(banded.map((row) => row.yrs)) || 1) || 1;
  for (let band = 0; band < 5; band += 1) state.a[band] = (state.a[band] ?? 1) / mean;
  for (const cat of Object.keys(state.c)) state.c[cat] = (state.c[cat] ?? state.r0) * mean;
}

/** The platform's iterative proportional fit, with a gamma prior worth K pseudo-events at the fleet rate. */
function ipf(rows: readonly Seed[], key: 'n' | 'h', K: number): Fit {
  const used = rows.filter((row) => row.yrs > 0);
  const r0 = sum(used.map((row) => row[key])) / (sum(used.map((row) => row.yrs)) || 1) || 1e-9;
  const c: Record<string, number> = {};
  for (const cat of new Set(used.map((row) => row.cat))) c[cat] = r0;
  const state: FitState = { used, key, K, c, a: [1, 1, 1, 1, 1], r0 };
  for (let iteration = 0; iteration < 40; iteration += 1) {
    fitCategories(state);
    fitBands(state);
    normaliseFit(state);
  }
  return { c: state.c, a: state.a, r0 };
}

/** The platform's 7-is-expected transform: each doubling of the ratio costs 3.5 points. */
const healthMap = (ratio: number): number =>
  Math.max(0, Math.min(10, 7 - 3.5 * Math.log2(Math.max(ratio, 1e-6))));

/** The health score's own label, from its 0–10 score. */
const healthLabel = (score: number): string =>
  score >= 8.5
    ? 'Excellent'
    : score >= 7
      ? 'Healthy'
      : score >= 5.5
        ? 'Fair'
        : score >= 3.5
          ? 'Poor'
          : 'Critical';

/** Days the machine was in service inside a window, both ends included, or zero when the window is before it. */
function overlap(purchase: number | null, from: number, to: number): number {
  const start = Math.max(from, purchase ?? Number.NEGATIVE_INFINITY);
  return Math.max(0, Math.round(to - start) + 1);
}

/** One machine's entries in its observed window, and its two 90-day counts for the trend component. */
interface History {
  readonly list: readonly SourcedReport[];
  readonly n90: number;
  readonly p90n: number;
}

/** Every production machine's health history: its window entries and the counts its trend part reads. */
function historiesOf(
  core: { from: string; to: string },
  data: EngineData,
  fleet: readonly BottleneckRisk[],
): Map<string, History> {
  const from = dayNumber(core.from) ?? 0;
  const end = dayNumber(core.to) ?? 0;
  const byMachine = new Map<string, SourcedReport[]>();
  for (const row of fleetRows(data)) {
    const list = byMachine.get(row.report.machineId) ?? [];
    list.push(row);
    byMachine.set(row.report.machineId, list);
  }
  const histories = new Map<string, History>();
  for (const risk of fleet) {
    const all = byMachine.get(risk.machine.id) ?? [];
    const purchase = purchaseDayOf(risk.machine);
    const start = purchase !== null && purchase > from ? purchase : from;
    const list = all.filter((row) => {
      const day = dayNumber(row.report.date);
      return day !== null && day >= start && day <= end;
    });
    histories.set(risk.machine.id, {
      list,
      n90: all.filter((row) => (dayNumber(row.report.date) ?? 0) > end - 90).length,
      p90n: all.filter((row) => {
        const day = dayNumber(row.report.date) ?? 0;
        return day <= end - 90 && day > end - 180;
      }).length,
    });
  }
  return histories;
}

/** The days of every maintenance code, ignoring a blank code and an unreadable date. */
function daysByCode(list: readonly SourcedReport[]): Map<string, number[]> {
  const byCode = new Map<string, number[]>();
  for (const row of list) {
    const code = (row.report.maintCode ?? '').trim();
    if (code === '' || code === '—') continue;
    const day = dayNumber(row.report.date);
    if (day === null) continue;
    const days = byCode.get(code) ?? [];
    days.push(day);
    byCode.set(code, days);
  }
  return byCode;
}

/** Three same-code days within a greedy 30-day run, counted once and then skipped. */
function clustersIn(days: number[]): number {
  days.sort((left, right) => left - right);
  let clusters = 0;
  let index = 0;
  while (index < days.length) {
    let end = index;
    while (end + 1 < days.length && (days[end + 1] ?? 0) - (days[index] ?? 0) <= 30) end += 1;
    if (end - index + 1 >= 3) {
      clusters += 1;
      index = end + 1;
    } else index += 1;
  }
  return clusters;
}

/** The platform's repeat-fault clusters over one machine's window. */
function clustersOf(list: readonly SourcedReport[]): number {
  let clusters = 0;
  for (const days of daysByCode(list).values()) clusters += clustersIn(days);
  return clusters;
}

/** The repeat-and-long-fault component: repeat clusters cost 2.5 points, a breakdown over the limit 1.5. */
function repeatScore(list: readonly SourcedReport[], threshold: number): number {
  const clusters = clustersOf(list);
  const long = list.filter((row) => effectiveHours(row.report) > threshold).length;
  return Math.max(0, Math.min(10, 10 - 2.5 * clusters - 1.5 * long));
}

/** One machine's health row: its expected hours and the label the decision lane reads. */
export interface HealthRow extends Seed {
  readonly risk: BottleneckRisk;
  readonly days: number;
  readonly expH: number;
  readonly score: number;
  readonly label: string;
}

/** What every row's score reads beside the machine: the two fits and its category's repair-time baseline. */
interface ScoreContext {
  readonly fits: { n: Fit; h: Fit };
  readonly m0: number;
  readonly end: number;
  readonly threshold: number;
}

/** One machine's health row, from its facts, history, the two fits and its category's repair-time baseline. */
function healthRowOf(risk: BottleneckRisk, history: History, context: ScoreContext): HealthRow {
  const cat = normalizeLabel(risk.machine.category ?? '');
  const yrs = risk.days / 365;
  const purchase = purchaseDayOf(risk.machine);
  const band = ageBand(purchase === null ? null : (context.end - purchase) / 365.25);
  const rateN =
    (context.fits.n.c[cat] ?? context.fits.n.r0) * (band >= 0 ? context.fits.n.a[band]! : 1);
  const rateH =
    (context.fits.h.c[cat] ?? context.fits.h.r0) * (band >= 0 ? context.fits.h.a[band]! : 1);
  const expN = rateN * yrs;
  const expH = rateH * yrs;
  const expectedRecent = (rateN * overlap(purchase, context.end - 89, context.end)) / 365;
  const expectedBefore = (rateN * overlap(purchase, context.end - 179, context.end - 90)) / 365;
  const parts: Array<readonly [number, number]> = [
    [0.3, healthMap((risk.count + 3) / (expN + 3))],
    [0.25, healthMap((risk.hours + 10) / (expH + 10))],
    [
      0.15,
      healthMap((risk.hours + 3 * context.m0) / (risk.count + 3) / Math.max(context.m0, 1e-6)),
    ],
    [
      0.15,
      healthMap(
        (history.n90 + 2) / (expectedRecent + 2) / ((history.p90n + 2) / (expectedBefore + 2)),
      ),
    ],
    [0.1, repeatScore(history.list, context.threshold)],
  ];
  const weight = sum(parts.map(([part]) => part));
  const score = sum(parts.map(([part, value]) => part * value)) / weight;
  return {
    risk,
    cat,
    yrs,
    band,
    n: risk.count,
    h: risk.hours,
    days: risk.days,
    expH,
    score,
    label: healthLabel(score),
  };
}

/** Every production machine's health row: one fit for counts, one for hours, and the category MTTR baseline. */
export function healthRowsOf(
  core: { from: string; to: string; fleet: readonly BottleneckRisk[] },
  data: EngineData,
  threshold: number,
): HealthRow[] {
  const end = dayNumber(core.to) ?? 0;
  const histories = historiesOf(core, data, core.fleet);
  const seeds: Seed[] = core.fleet.map((risk) => {
    const purchase = purchaseDayOf(risk.machine);
    return {
      cat: normalizeLabel(risk.machine.category ?? ''),
      yrs: risk.days / 365,
      band: ageBand(purchase === null ? null : (end - purchase) / 365.25),
      n: risk.count,
      h: risk.hours,
    };
  });
  const fits = { n: ipf(seeds, 'n', 4), h: ipf(seeds, 'h', 40) };
  const totals = new Map<string, { n: number; h: number }>();
  for (const seed of seeds) {
    const total = totals.get(seed.cat) ?? { n: 0, h: 0 };
    total.n += seed.n;
    total.h += seed.h;
    totals.set(seed.cat, total);
  }
  const plantN = sum(seeds.map((seed) => seed.n));
  const plantM0 = plantN > 0 ? sum(seeds.map((seed) => seed.h)) / plantN : 1;
  return core.fleet.map((risk) => {
    const cat = normalizeLabel(risk.machine.category ?? '');
    const total = totals.get(cat);
    const m0 = total !== undefined && total.n > 0 ? total.h / total.n : plantM0;
    const history = histories.get(risk.machine.id) ?? { list: [], n90: 0, p90n: 0 };
    return healthRowOf(risk, history, { fits, m0, end, threshold });
  });
}
