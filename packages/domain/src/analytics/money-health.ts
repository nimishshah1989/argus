import type { BottleneckCore } from './a9-bottleneck.js';
import { observedDays } from './availability.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, isPm, sourcedReports } from './rows.js';
import { isProduction } from './machine-facts.js';
import type { EngineData, MachineRow, ReportRow } from './types.js';

/**
 * The Compare health model's arithmetic, shared by Money Matters (ticket 43, packet 43c): a machine's expected
 * hours for its age and category and the 0-10 score the Compare page prints. Pinned to the same 11 November key
 * as the Compare figure, so the poor-machine lever and the overhaul lane read one model, never two.
 *
 * The file split follows the hard 400-line budget, the same reason 42b and 42d split their own work.
 */

const WEIGHTS = { freq: 0.3, hrs: 0.25, mttr: 0.15, trend: 0.15, repeat: 0.1 } as const;

/** One production machine's facts as the health model reads them. */
interface Fact {
  machine: MachineRow;
  category: string;
  days: number;
  years: number;
  band: number;
  service: number | null;
  n: number;
  hours: number;
  /** Every non-PM report of the machine; the trend and repeat checks read past the window's start. */
  all: ReportRow[];
  /** The reports inside the machine's own window; the counts and hours read these. */
  list: ReportRow[];
}

/** A machine's expected hours and health score, age- and category-adjusted. */
export interface Health {
  machineId: string;
  category: string;
  days: number;
  n: number;
  hours: number;
  expH: number;
  score: number;
  label: string;
}

interface Fit {
  c: Map<string, number>;
  a: number[];
  r0: number;
}

interface HealthContext {
  fitN: Fit;
  fitH: Fit;
  mttr: Map<string, number>;
  end: number;
  threshold: number;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** The Compare model's five age bands; -1 when the age is unknown or negative, and its 0-10 map. */
const ageBand = (age: number): number =>
  age < 3 ? 0 : age < 6 ? 1 : age < 10 ? 2 : age < 15 ? 3 : age < 999 ? 4 : -1;
const mapped = (ratio: number): number =>
  Math.max(0, Math.min(10, 7 - 3.5 * Math.log2(Math.max(ratio, 1e-6))));
const scoreLabel = (score: number): string =>
  score >= 8.5
    ? 'Excellent'
    : score >= 7
      ? 'Healthy'
      : score >= 5.5
        ? 'Fair'
        : score >= 3.5
          ? 'Poor'
          : 'Critical';

/** A production machine's window facts: its own period from purchase, its non-PM reports and their hours. */
function factsOf(data: EngineData, core: BottleneckCore): Fact[] {
  const from = dayNumber(core.from) ?? 0;
  const to = dayNumber(core.to) ?? 0;
  const window = { from: core.from, to: core.to, noRecords: core.noRecords };
  const byMachine = new Map<string, ReportRow[]>();
  for (const row of sourcedReports(data)) {
    if (isPm(row)) continue;
    byMachine.set(row.report.machineId, [
      ...(byMachine.get(row.report.machineId) ?? []),
      row.report,
    ]);
  }
  return data.machines.filter(isProduction).map((machine) => {
    const bought =
      machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));
    const start = bought !== null && bought > from ? bought : from;
    const days = observedDays(core.from, core.to, window, machine.purchasedOn?.slice(0, 10));
    const all = byMachine.get(machine.id) ?? [];
    const list = all.filter((report) => {
      const day = dayNumber(report.date);
      return day !== null && day >= start && day <= to;
    });
    const age = bought === null ? null : (to - bought) / 365.25;
    return {
      machine,
      category: machine.category ?? '',
      days,
      years: days / 365,
      band: age !== null && age >= 0 ? ageBand(age) : -1,
      service: bought,
      n: list.length,
      hours: sum(list.map(effectiveHours)),
      all,
      list,
    };
  });
}

interface FitInput {
  key: 'n' | 'hours';
  r0: number;
  prior: number;
}

/** One category's level in the iterated fit: its own rate, pulled toward the fleet. */
const categoryLevel = (own: readonly Fact[], a: readonly number[], input: FitInput): number =>
  (sum(own.map((row) => row[input.key])) + input.prior) /
  (sum(own.map((row) => row.years * (row.band >= 0 ? (a[row.band] ?? 1) : 1))) +
    input.prior / input.r0);

/** One age band's factor in the iterated fit: 1 for a band the fleet does not have. */
const bandLevel = (
  own: readonly Fact[],
  c: ReadonlyMap<string, number>,
  input: FitInput,
): number =>
  own.length === 0
    ? 1
    : (sum(own.map((row) => row[input.key])) + input.prior) /
      (sum(own.map((row) => row.years * (c.get(row.category) ?? input.r0))) + input.prior);

/** The Compare model's iterated category-and-age fit: a multiplicative rate per machine-year, pulled to the fleet. */
function ipf(rows: readonly Fact[], key: 'n' | 'hours', prior: number): Fit {
  const used = rows.filter((row) => row.years > 0);
  const r0 = sum(used.map((row) => row[key])) / (sum(used.map((row) => row.years)) || 1) || 1e-9;
  const categories = [...new Set(used.map((row) => row.category))];
  const c = new Map(categories.map((category) => [category, r0]));
  const a = [1, 1, 1, 1, 1];
  const input: FitInput = { key, r0, prior };
  for (let round = 0; round < 40; round += 1) {
    for (const category of categories) {
      const own = used.filter((row) => row.category === category);
      c.set(category, categoryLevel(own, a, input));
    }
    for (let band = 0; band < a.length; band += 1) {
      const own = used.filter((row) => row.band === band);
      a[band] = bandLevel(own, c, input);
    }
    const banded = used.filter((row) => row.band >= 0);
    const weight = sum(banded.map((row) => row.years)) || 1;
    const mean = sum(banded.map((row) => row.years * (a[row.band] ?? 1))) / weight || 1;
    for (let band = 0; band < a.length; band += 1) a[band] = (a[band] ?? 1) / mean;
    for (const category of categories) c.set(category, (c.get(category) ?? r0) * mean);
  }
  return { c, a, r0 };
}

/** The expected rate for one machine: its category's level times its age band's factor. */
const rateOf = (fit: Fit, fact: Fact): number =>
  (fit.c.get(fact.category) ?? fit.r0) * (fact.band >= 0 ? (fit.a[fact.band] ?? 1) : 1);

/** The category's mean repair hours, or the fleet's when the category has no breakdown. */
function categoryMttr(fit: readonly Fact[]): Map<string, number> {
  const totalN = sum(fit.map((row) => row.n));
  const fleet = totalN > 0 ? sum(fit.map((row) => row.hours)) / totalN : 1;
  const means = new Map<string, number>();
  for (const category of new Set(fit.map((row) => row.category))) {
    const own = fit.filter((row) => row.category === category);
    const n = sum(own.map((row) => row.n));
    means.set(category, n > 0 ? sum(own.map((row) => row.hours)) / n : fleet);
  }
  return means;
}

/** The clusters of three or more entries whose first and last are within thirty days. */
function clustersOf(days: number[]): number {
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

/** The repeat-fault clusters and over-threshold breakdowns of one machine's window (the score's last part). */
function repeatsOf(
  list: readonly ReportRow[],
  threshold: number,
): { clusters: number; long: number } {
  const byCode = new Map<string, number[]>();
  for (const report of list) {
    const code = String(report.maintCode ?? '').trim();
    const day = dayNumber(report.date);
    if (code === '' || code === '—' || day === null) continue;
    byCode.set(code, [...(byCode.get(code) ?? []), day]);
  }
  let clusters = 0;
  for (const days of byCode.values()) clusters += clustersOf(days);
  return { clusters, long: list.filter((report) => effectiveHours(report) > threshold).length };
}

/** One machine's health row: its expected hours and the five-part score the Compare page prints. */
function healthOf(fact: Fact, context: HealthContext): Health {
  const rateN = rateOf(context.fitN, fact);
  const end = context.end;
  const expH = rateOf(context.fitH, fact) * fact.years;
  const expN = rateN * fact.years;
  const mean = context.mttr.get(fact.category) ?? 1;
  const ov = (first: number, last: number): number =>
    Math.max(0, Math.round(Math.min(last, end) - Math.max(first, fact.service ?? -Infinity)) + 1);
  const dayOf = (report: ReportRow): number => dayNumber(report.date) ?? 0;
  const recent = fact.all.filter((report) => dayOf(report) > end - 90).length;
  const before = fact.all.filter(
    (report) => dayOf(report) <= end - 90 && dayOf(report) > end - 180,
  ).length;
  const eR = (rateN * ov(end - 89, end)) / 365;
  const eP = (rateN * ov(end - 179, end - 90)) / 365;
  const repeat = repeatsOf(fact.list, context.threshold);
  const comps: Array<[number, number]> = [
    [WEIGHTS.freq, mapped((fact.n + 3) / (expN + 3))],
    [WEIGHTS.hrs, mapped((fact.hours + 10) / (expH + 10))],
    [WEIGHTS.mttr, mapped((fact.hours + 3 * mean) / (fact.n + 3) / Math.max(mean, 1e-6))],
    [WEIGHTS.trend, mapped((recent + 2) / (eR + 2) / ((before + 2) / (eP + 2)))],
    [WEIGHTS.repeat, Math.max(0, Math.min(10, 10 - 2.5 * repeat.clusters - 1.5 * repeat.long))],
  ];
  const weight = sum(comps.map(([part]) => part));
  const score = sum(comps.map(([part, value]) => part * value)) / weight;
  return {
    machineId: fact.machine.id,
    category: fact.category,
    days: fact.days,
    n: fact.n,
    hours: fact.hours,
    expH,
    score,
    label: scoreLabel(score),
  };
}

/** The whole fleet's health rows, fitted on the machines with a positive observation window. */
export function healthRows(data: EngineData, core: BottleneckCore, threshold: number): Health[] {
  const facts = factsOf(data, core);
  const fit = facts.filter((fact) => fact.days > 0);
  const context: HealthContext = {
    fitN: ipf(fit, 'n', 4),
    fitH: ipf(fit, 'hours', 40),
    mttr: categoryMttr(fit),
    end: dayNumber(core.to) ?? 0,
    threshold,
  };
  return facts.map((fact) => healthOf(fact, context));
}
