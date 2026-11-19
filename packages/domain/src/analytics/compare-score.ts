import { observedDays, type Period } from './availability.js';
import { formatNumber } from './format.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, isHistory, sourcedReports, type SourcedReport } from './rows.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * The Compare page's arithmetic (ticket 43, packet 43a): one machine's figures over its own service window, the
 * fleet's category × age-band expectation (Guide section 24), the six weighted parts and the category reference
 * column. The platform source is the authority for every rule; the page assembly lives in `compare.ts`.
 */

const AGE_BANDS = [
  [0, 3],
  [3, 6],
  [6, 10],
  [10, 15],
  [15, 999],
] as const;
export const PARTS = [
  { key: 'freq', label: 'Breakdown frequency', weight: 0.3 },
  { key: 'hrs', label: 'Downtime hours', weight: 0.25 },
  { key: 'mttr', label: 'Repair time (MTTR)', weight: 0.15 },
  { key: 'trend', label: 'Recent trend', weight: 0.15 },
  { key: 'repeat', label: 'Repeat & very long faults', weight: 0.1 },
  { key: 'spares', label: 'Spares cost', weight: 0.05 },
] as const;

type Hours = { n: number; h: number };
export type Component = {
  key: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
};
type Rates = { c: Record<string, number>; a: number[]; r0: number };

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);
const categoryOf = (machine: MachineRow): string => machine.category ?? '';
const isRobotCategory = (machine: MachineRow): boolean =>
  /^robot/i.test((machine.category ?? '').trim());
export const boughtOf = (machine: MachineRow): number | null =>
  machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));

/** The CNC machines the page ranks: the platform's machine list, minus a machine whose category is Robot. */
export const compareMachines = (data: EngineData): MachineRow[] =>
  data.machines.filter((machine) => machine.segment === 'CNC' && !isRobotCategory(machine));

/** Every history report: the platform's state.breakdowns, never the live app's tickets. */
export const historyRows = (data: EngineData): SourcedReport[] =>
  sourcedReports(data).filter((row) => isHistory(row));

/** The period: 1 January of the first entry's year to the last entry, and the months in it with no records. */
export type ComparePeriod = Period & { start: number; end: number };
export function periodOf(rows: readonly SourcedReport[], noRecords: readonly string[] = []) {
  const dates = rows.map((row) => row.report.date).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const from = `${first?.slice(0, 4)}-01-01`;
  const start = first === undefined ? null : dayNumber(from);
  const end = last === undefined ? null : dayNumber(last);
  if (start === null || end === null || last === undefined) return null;
  return { from, to: last, start, end, noRecords } satisfies ComparePeriod;
}

/** The age band the Guide's scorecard groups a machine in; -1 when its purchase date is unknown. */
function bandOf(machine: MachineRow, period: ComparePeriod): number {
  const bought = boughtOf(machine);
  if (bought === null) return -1;
  const age = (period.end - bought) / 365.25;
  return age < 0 ? -1 : AGE_BANDS.findIndex(([low, high]) => age >= low && age < high);
}

/** One machine's maintenance-code, shift, electrical/mechanical and month totals, from its own rows. */
function tallyOf(list: readonly SourcedReport[]) {
  const codes: Record<string, Hours> = {};
  const shifts: Record<string, Hours> = {};
  const em = { E: 0, M: 0 };
  const months: Record<number, number> = {};
  for (const row of list) {
    const hours = effectiveHours(row.report);
    const code = (row.report.maintCode ?? '—').trim() || '—';
    const c = codes[code] ?? { n: 0, h: 0 };
    c.n += 1;
    c.h += hours;
    codes[code] = c;
    const shift = String(row.report.shift || '—');
    const s = shifts[shift] ?? { n: 0, h: 0 };
    s.n += 1;
    s.h += hours;
    shifts[shift] = s;
    const kind = String(row.report.category ?? '')
      .trim()
      .toUpperCase();
    if (kind === 'E' || kind === 'M') em[kind] += 1;
    const month =
      Number(row.report.date.slice(0, 4)) * 100 + Number(row.report.date.slice(5, 7)) - 1;
    months[month] = (months[month] ?? 0) + hours;
  }
  return { codes, shifts, em, months };
}

export type Window = { period: ComparePeriod; perDay: number };

/** One machine's figures over its own service window, as the platform's cmpStats reads them. */
export function statsOf(
  machine: MachineRow,
  rows: readonly SourcedReport[],
  pms: readonly SourcedReport[],
  window: Window,
) {
  const { period, perDay } = window;
  const bought = boughtOf(machine);
  const start = bought !== null && bought > period.start ? bought : period.start;
  const days = observedDays(period.from, period.to, period, machine.purchasedOn?.slice(0, 10));
  const inWindow = (row: SourcedReport): boolean => {
    const day = dayNumber(row.report.date);
    return day !== null && day >= start && day <= period.end;
  };
  const list = rows.filter(inWindow);
  const n = list.length;
  const h = sum(list.map((row) => effectiveHours(row.report)));
  const avail = Math.max(1, days) * perDay;
  const last = rows.reduce<number | null>((latest, row) => {
    const day = dayNumber(row.report.date);
    return day === null || (latest !== null && day <= latest) ? latest : day;
  }, null);
  const inLast = (row: SourcedReport): boolean =>
    (dayNumber(row.report.date) ?? 0) > period.end - 90;
  const inPrior = (row: SourcedReport): boolean => {
    const day = dayNumber(row.report.date);
    return day !== null && day <= period.end - 90 && day > period.end - 180;
  };
  return {
    machine,
    list,
    n,
    h,
    days,
    yrs: days / 365,
    a: avail > 0 ? 1 - Math.min(1, h / avail) : 1,
    mttr: n > 0 ? h / n : 0,
    mtbf: n > 0 ? (avail - h) / n : avail,
    perMonth: (n / Math.max(1, days)) * 30.4,
    hPerMonth: (h / Math.max(1, days)) * 30.4,
    max: list.reduce((top, row) => Math.max(top, effectiveHours(row.report)), 0),
    daysSince: last === null ? null : Math.round(period.end - last),
    n90: rows.filter(inLast).length,
    p90n: rows.filter(inPrior).length,
    pmN: pms.filter(inWindow).length,
    ...tallyOf(list),
    band: bandOf(machine, period),
    score: 0,
    comps: [] as Component[],
  };
}

export type Compared = ReturnType<typeof statsOf>;

const cmpMap = (ratio: number): number =>
  Math.max(0, Math.min(10, 7 - 3.5 * Math.log2(Math.max(ratio, 1e-6))));

type FitArgs = {
  rows: readonly Compared[];
  categories: readonly string[];
  key: 'n' | 'h';
  k: number;
};

/** One pass of the category level: expected = the age factor of each machine's band. */
function categoryLevels(args: FitArgs, a: readonly number[], r0: number): Record<string, number> {
  const c: Record<string, number> = {};
  for (const category of args.categories) {
    const group = args.rows.filter((row) => categoryOf(row.machine) === category);
    const expected = sum(group.map((row) => row.yrs * (row.band >= 0 ? (a[row.band] ?? 1) : 1)));
    c[category] = (sum(group.map((row) => row[args.key])) + args.k) / (expected + args.k / r0);
  }
  return c;
}

/** One pass of the age factor: expected = the category level of each machine's category. */
function bandLevels(args: FitArgs, c: Readonly<Record<string, number>>): number[] {
  const a = [1, 1, 1, 1, 1];
  for (let band = 0; band < 5; band += 1) {
    const group = args.rows.filter((row) => row.band === band);
    const expected = sum(group.map((row) => row.yrs * (c[categoryOf(row.machine)] ?? 1)));
    a[band] =
      group.length === 0
        ? 1
        : (sum(group.map((row) => row[args.key])) + args.k) / (expected + args.k);
  }
  return a;
}

/** The fleet's mean age factor, the level the fit pulls every category and band back toward. */
function meanAge(rows: readonly Compared[], a: readonly number[]): number {
  const banded = rows.filter((row) => row.band >= 0);
  const weight = sum(banded.map((row) => row.yrs)) || 1;
  return sum(banded.map((row) => row.yrs * (a[row.band] ?? 1))) / weight || 1;
}

/** The platform's multiplicative fit: category level × age factor, pulled toward the fleet average. */
export function fitRates(rows: readonly Compared[], key: 'n' | 'h', k: number): Rates {
  const usable = rows.filter((row) => row.yrs > 0);
  const r0 = sum(usable.map((row) => row[key])) / (sum(usable.map((row) => row.yrs)) || 1) || 1e-9;
  const args: FitArgs = {
    rows: usable,
    categories: [...new Set(usable.map((row) => categoryOf(row.machine)))],
    key,
    k,
  };
  let c: Record<string, number> = Object.fromEntries(
    args.categories.map((category) => [category, r0]),
  );
  let a = [1, 1, 1, 1, 1];
  for (let pass = 0; pass < 40; pass += 1) {
    c = categoryLevels(args, a, r0);
    a = bandLevels(args, c);
    const mean = meanAge(usable, a);
    a = a.map((value) => value / mean);
    c = Object.fromEntries(Object.entries(c).map(([category, value]) => [category, value * mean]));
  }
  return { c, a, r0 };
}

export type Fitted = ReturnType<typeof fitRates>;

/** The category's typical hours per repair, the MTTR part's baseline. */
export function categoryMttr(rows: readonly Compared[]): Map<string, number> {
  const totals = new Map<string, { n: number; h: number }>();
  for (const row of rows) {
    const total = totals.get(categoryOf(row.machine)) ?? { n: 0, h: 0 };
    total.n += row.n;
    total.h += row.h;
    totals.set(categoryOf(row.machine), total);
  }
  return new Map(
    [...totals].map(([category, total]) => [category, total.n > 0 ? total.h / total.n : 1]),
  );
}

/** The clusters in one code's sorted days: three or more within 30 days of the cluster's first day. */
function clustersOf(days: number[]): number {
  days.sort((left, right) => left - right);
  let clusters = 0;
  let index = 0;
  while (index < days.length) {
    let end = index;
    while (end + 1 < days.length && (days[end + 1] ?? 0) - (days[index] ?? 0) <= 30) end += 1;
    const clustered = end - index + 1 >= 3;
    if (clustered) clusters += 1;
    index = clustered ? end + 1 : index + 1;
  }
  return clusters;
}

/** The platform's repeat-fault clusters and very long faults, from the machine's own rows. */
function repeatOf(
  list: readonly SourcedReport[],
  threshold: number,
): { clusters: number; long: number } {
  const byCode = new Map<string, number[]>();
  for (const row of list) {
    const code = String(row.report.maintCode ?? '').trim();
    const day = dayNumber(row.report.date);
    if (code === '' || code === '—' || day === null) continue;
    byCode.set(code, [...(byCode.get(code) ?? []), day]);
  }
  let clusters = 0;
  for (const days of byCode.values()) clusters += clustersOf(days);
  return { clusters, long: list.filter((row) => effectiveHours(row.report) > threshold).length };
}

/** The days a service window covers, from the later of the window and the purchase date to its end. */
const coverage = (bought: number | null, from: number, to: number, end: number): number =>
  Math.max(
    0,
    Math.round(Math.min(to, end) - (bought === null ? from : Math.max(from, bought))) + 1,
  );

export type ScoreContext = {
  fitN: Fitted;
  fitH: Fitted;
  base: ReadonlyMap<string, number>;
  threshold: number;
  end: number;
};

/** A fitted level for one machine: its category's level times its age band's factor. */
function levelOf(fit: Fitted, category: string, band: number): number {
  return (fit.c[category] ?? fit.r0) * (band >= 0 ? (fit.a[band] ?? 1) : 1);
}

/** The recent-against-prior ratio, each window against what the machine's rate expected there. */
function trendOf(row: Compared, levelN: number, end: number): number {
  const bought = boughtOf(row.machine);
  const recent = (levelN * coverage(bought, end - 89, end, end)) / 365;
  const prior = (levelN * coverage(bought, end - 179, end - 90, end)) / 365;
  return ((row.n90 + 2) / (recent + 2) || 0) / ((row.p90n + 2) / (prior + 2) || 1);
}

/** The repeat part's printed text, with the platform's plural forms. */
function repeatDetail(repeat: { clusters: number; long: number }, threshold: number): string {
  const clusters = `${repeat.clusters} repeat-fault cluster${repeat.clusters === 1 ? '' : 's'}`;
  return `${clusters}, ${repeat.long} breakdown${repeat.long === 1 ? '' : 's'} over ${threshold} hrs`;
}

/** The scorecard's parts, with the platform's short-history protection and its exact printed details. */
function componentsOf(row: Compared, context: ScoreContext): Component[] {
  const category = categoryOf(row.machine);
  const mttrBase = context.base.get(category) ?? 1;
  const levelN = levelOf(context.fitN, category, row.band);
  const levelH = levelOf(context.fitH, category, row.band);
  const comps: Component[] = [];
  const add = (key: string, score: number, detail: string): void => {
    const part = PARTS.find((candidate) => candidate.key === key);
    if (part) comps.push({ key, label: part.label, weight: part.weight, score, detail });
  };
  add(
    'freq',
    cmpMap((row.n + 3) / (levelN * row.yrs + 3)),
    `${formatNumber(row.n, 0)} breakdowns against ${formatNumber(levelN * row.yrs, 1)} expected`,
  );
  add(
    'hrs',
    cmpMap((row.h + 10) / (levelH * row.yrs + 10)),
    `${formatNumber(row.h, 1)} hrs against ${formatNumber(levelH * row.yrs, 1)} expected`,
  );
  add(
    'mttr',
    cmpMap((row.h + 3 * mttrBase) / (row.n + 3) / Math.max(mttrBase, 1e-6)),
    `${row.n > 0 ? formatNumber(row.mttr, 2) : '—'} hrs per repair against ${formatNumber(mttrBase, 2)} for the category`,
  );
  add(
    'trend',
    cmpMap(trendOf(row, levelN, context.end)),
    `${row.n90} breakdowns in the last 90 days, ${row.p90n} in the 90 days before`,
  );
  const repeat = repeatOf(row.list, context.threshold);
  add(
    'repeat',
    Math.max(0, Math.min(10, 10 - 2.5 * repeat.clusters - 1.5 * repeat.long)),
    repeatDetail(repeat, context.threshold),
  );
  return comps;
}

/** One machine's full score: the weighted average of the parts it has, as the Guide's section 24 says. */
export function scoreOf(row: Compared, context: ScoreContext): Compared {
  const comps = componentsOf(row, context);
  const weight = sum(comps.map((part) => part.weight));
  return {
    ...row,
    comps,
    score: weight > 0 ? sum(comps.map((part) => part.weight * part.score)) / weight : 0,
  };
}

/** A category's machines, most numerous first; the page's default category is the first of these. */
export function categoriesOf(
  machines: readonly MachineRow[],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const machine of machines) {
    if (categoryOf(machine) === '') continue;
    counts.set(categoryOf(machine), (counts.get(categoryOf(machine)) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

/** The peer column: the category's average of the same numbers, each machine from its own purchase date. */
export function referenceOf(pool: readonly Compared[], same: boolean) {
  const average = (value: (row: Compared) => number): number =>
    pool.length > 0 ? sum(pool.map(value)) / pool.length : 0;
  const withBreakdowns = pool.filter((row) => row.n > 0);
  return {
    same,
    count: pool.length,
    a: average((row) => row.a),
    n: average((row) => row.n),
    h: average((row) => row.h),
    mttr:
      withBreakdowns.length > 0
        ? sum(withBreakdowns.map((row) => row.mttr)) / withBreakdowns.length
        : 0,
    perMonth: average((row) => row.perMonth),
    hPerMonth: average((row) => row.hPerMonth),
    cost: average(() => 0),
    max: average((row) => row.max),
    mtbf: average((row) => row.mtbf),
  };
}

export type Reference = ReturnType<typeof referenceOf>;
