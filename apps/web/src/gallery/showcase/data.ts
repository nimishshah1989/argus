import { figure } from '../directions/figures.js';

/** The `showcase` figure `tools/directions-figures.ts` writes: monthly series taken from the engine's own output. */
export interface Showcase {
  asOf: string;
  months: string[];
  plant: {
    bdPct: (number | null)[];
    pmPct: (number | null)[];
    mttr: (number | null)[];
    mtbf: (number | null)[];
    mttrYear: number;
    mtbfYear: number;
    bdHours: number[];
    pmHours: number[];
  };
  detail: {
    breakdowns: number;
    topCause: { name: string; hours: number } | null;
    worstMachine: { id: string; hours: number } | null;
    longest: { machine: string; cause: string; hours: number; date: string } | null;
  }[];
  cells: { cell: string; bdPct: (number | null)[]; pmPct: (number | null)[] }[];
  totalHours: number;
  causes: {
    name: string;
    hours: number;
    breakdowns: number;
    machines: { id: string; hours: number }[];
  }[];
  heat: { id: string; hours: number[] }[];
}

export const S = figure<Showcase>('showcase');

/** The snapshot's last month is still running when the data stops before its 28th: rates are fine, sums are not. */
export const PARTIAL = Number(S.asOf.slice(8)) < 28;
/** How many months are complete. */
export const FULL = PARTIAL ? S.months.length - 1 : S.months.length;
/** A breakdown this long (a whole day) gets a marker on the trend. */
export const BIG_HOURS = 24;

export type MetricId = 'availability' | 'downtime' | 'breakdowns' | 'mtbf' | 'mttr' | 'pm';

export interface Metric {
  id: MetricId;
  unit: '%' | 'h' | '';
  digits: number;
  /** Which way is good; `none` for planned work, which is neither. */
  better: 'up' | 'down' | 'none';
  /** A sum over the month: a month in progress cannot be compared with a full one. */
  additive: boolean;
  headline: number;
  values: (number | null)[];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const { plant } = S;

const availability = plant.bdPct.map((bd, i) =>
  bd === null ? null : r2(100 - bd - (plant.pmPct[i] ?? 0)),
);

export const METRICS: Metric[] = [
  {
    id: 'availability',
    unit: '%',
    digits: 2,
    better: 'up',
    additive: false,
    headline: figure<number>('dashboard.fleet-availability'),
    values: availability,
  },
  {
    id: 'downtime',
    unit: 'h',
    digits: 1,
    better: 'down',
    additive: true,
    headline: figure<number>('dashboard.total-downtime-hours'),
    values: plant.bdHours,
  },
  {
    id: 'breakdowns',
    unit: '',
    digits: 0,
    better: 'down',
    additive: true,
    headline: figure<number>('dashboard.total-breakdowns'),
    values: S.detail.map((d) => d.breakdowns),
  },
  {
    id: 'mtbf',
    unit: 'h',
    digits: 1,
    better: 'up',
    additive: false,
    headline: plant.mtbfYear,
    values: plant.mtbf,
  },
  {
    id: 'mttr',
    unit: 'h',
    digits: 2,
    better: 'down',
    additive: false,
    headline: plant.mttrYear,
    values: plant.mttr,
  },
  {
    id: 'pm',
    unit: 'h',
    digits: 1,
    better: 'none',
    additive: true,
    headline: figure<number>('dashboard.pm-hours'),
    values: plant.pmHours,
  },
];

export const metricOf = (id: MetricId): Metric => METRICS.find((m) => m.id === id)!;

const INDIAN = new Map<number, Intl.NumberFormat>();
/** A figure with a fixed number of decimals and Indian grouping (`1,00,000.50`); a missing value prints a dash. */
export function fixed(n: number | null | undefined, digits: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  let fmt = INDIAN.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    INDIAN.set(digits, fmt);
  }
  return fmt.format(n);
}

export type Tone = 'good' | 'bad' | 'flat';

export interface Change {
  /** Absolute difference, in the metric's unit. */
  delta: number;
  dir: 'up' | 'down' | 'flat';
  tone: Tone;
  /** The month it is compared with (the one before). */
  from: number;
}

/**
 * Month `i` against the month before it, from the engine's own series. A month with no value, or a month in
 * progress for a summed figure, has no comparison and answers null: nothing is guessed.
 */
export function change(metric: Metric, i: number): Change | null {
  const now = metric.values[i];
  const before = metric.values[i - 1];
  if (i < 1 || now == null || before == null) return null;
  if (metric.additive && PARTIAL && i >= FULL) return null;
  const delta = Math.round((now - before) * 10 ** (metric.digits + 1)) / 10 ** (metric.digits + 1);
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  let tone: Tone = 'flat';
  if (dir !== 'flat' && metric.better !== 'none')
    tone = (dir === 'up') === (metric.better === 'up') ? 'good' : 'bad';
  return { delta: Math.abs(delta), dir, tone, from: i - 1 };
}

/** The mean of the complete months and one standard deviation either side: where this figure usually sits. */
export function usualRange(metric: Metric): [number, number] {
  const v = metric.values.slice(0, FULL).filter((x): x is number => x !== null);
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
  const hi = mean + sd;
  return [Math.max(0, r2(mean - sd)), metric.unit === '%' ? Math.min(100, r2(hi)) : r2(hi)];
}

const YEAR = S.asOf.slice(0, 4);
const monthDate = (i: number) => new Date(Date.UTC(Number(YEAR), i, 1));
/** `October` for month index 9. */
export const monthLong = (i: number): string =>
  monthDate(i).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
export const YEAR_TEXT = YEAR;
/** `11 Nov 2026`. */
export const AS_OF_TEXT = new Date(`${S.asOf}T00:00:00Z`).toLocaleString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const LAST_FULL = FULL - 1;

/** Whether a cell's value beats the plant's for the same month: lower breakdown share is better. */
export function against(value: number | null, plant: number | null): Tone {
  if (value === null || plant === null || value === plant) return 'flat';
  return value < plant ? 'good' : 'bad';
}
