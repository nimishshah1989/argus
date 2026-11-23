import type { CompareFigure } from '../../../ui/v2/domain/compare-box.js';
import type { MachineData } from '../../../ui/v2/domain/plant.js';
import { glue } from '../dashboard/fixture-text.js';
import { RATE, WEEKS_SO_FAR, type Year } from './fixture-rows.js';

/** One machine's year, added up from its breakdowns. */
export type Stats = {
  machine: MachineData;
  year: Year;
  tenths: number;
  count: number;
  /** Per problem: how many breakdowns and how many tenths of an hour. */
  causes: Map<string, { count: number; tenths: number }>;
};

export function statsOf(machine: MachineData, year: Year): Stats {
  const causes = new Map<string, { count: number; tenths: number }>();
  for (const b of year.breakdowns) {
    const c = causes.get(b.cause) ?? { count: 0, tenths: 0 };
    causes.set(b.cause, { count: c.count + 1, tenths: c.tenths + b.tenths });
  }
  const tenths = year.breakdowns.reduce((s, b) => s + b.tenths, 0);
  return { machine, year, tenths, count: year.breakdowns.length, causes };
}

export const hours = (s: Stats) => s.tenths / 10;
export const rupees = (s: Stats) => hours(s) * RATE;
export const lakh = (rupee: number) => glue(`₹ ${(rupee / 100000).toFixed(2)} lakh`);
const h1 = (v: number) => glue(`${v.toFixed(1)} h`);

/** A measure of the pair: how to read it from a year, print it, and which way is better. */
type Metric = {
  id: string;
  label: string;
  hint: string;
  get: (s: Stats) => number;
  show: (s: Stats) => string;
  lowerIsBetter: boolean;
  /** What to compare to size the gap, when the figure itself hides it (availability near 100%). */
  size?: (v: number) => number;
  worse: (n: string) => string;
};

const mtbf = (s: Stats) => (s.year.planned - hours(s)) / s.count;
const available = (s: Stats) => ((s.year.planned - hours(s)) / s.year.planned) * 100;

export const METRICS: Metric[] = [
  {
    id: 'hours',
    label: 'Breakdown hours',
    hint: 'This year so far',
    get: hours,
    show: (s) => h1(hours(s)),
    lowerIsBetter: true,
    worse: (n) => `${n}× more`,
  },
  {
    id: 'count',
    label: 'Breakdowns',
    hint: 'This year so far',
    get: (s) => s.count,
    show: (s) => String(s.count),
    lowerIsBetter: true,
    worse: (n) => `${n}× more`,
  },
  {
    id: 'mttr',
    label: 'Time to repair',
    hint: 'Average per breakdown',
    get: (s) => hours(s) / s.count,
    show: (s) => h1(hours(s) / s.count),
    lowerIsBetter: true,
    worse: (n) => `${n}× slower`,
  },
  {
    id: 'mtbf',
    label: 'Time between failures',
    hint: 'Average running hours between two',
    get: mtbf,
    show: (s) => glue(`${Math.round(mtbf(s)).toLocaleString('en-IN')} h`),
    lowerIsBetter: false,
    worse: (n) => `${n}× shorter`,
  },
  {
    id: 'avail',
    label: 'Availability',
    hint: 'Share of planned time running',
    get: available,
    show: (s) => `${available(s).toFixed(2)}%`,
    lowerIsBetter: false,
    size: (v) => 100 - v,
    worse: (n) => `${n}× more downtime`,
  },
  {
    id: 'money',
    label: 'Money lost',
    hint: 'At ₹ 3,329 an hour',
    get: rupees,
    show: (s) => lakh(rupees(s)),
    lowerIsBetter: true,
    worse: (n) => `${n}× more`,
  },
];

/** Below this, two figures are about the same. */
const SAME = 1.05;

/** How many times bigger the bigger of the pair's figures is than the smaller (1 or more). */
function gap(m: Metric, a: Stats, b: Stats): number {
  const size = m.size ?? ((v: number) => v);
  const [x, y] = [size(m.get(a)), size(m.get(b))];
  return Math.max(x, y) / Math.min(x, y);
}

/**
 * The pair's figures for each side, in the same order, the biggest gap first. The two sides' marks never agree:
 * one is ahead, the other behind, or both are about the same.
 */
export function figures(a: Stats, b: Stats): [CompareFigure[], CompareFigure[]] {
  const rows = METRICS.map((m) => ({ m, ratio: gap(m, a, b) })).sort((p, q) => q.ratio - p.ratio);
  const side = (me: Stats, other: Stats): CompareFigure[] =>
    rows.map(({ m, ratio }) => {
      const worse = m.lowerIsBetter ? m.get(me) > m.get(other) : m.get(me) < m.get(other);
      const mark = ratio < SAME ? 'same' : worse ? 'worse' : 'better';
      const text = { same: 'About the same', better: 'Better', worse: m.worse(ratio.toFixed(1)) };
      return {
        id: m.id,
        label: m.label,
        hint: m.hint,
        value: m.show(me),
        mark,
        markText: text[mark],
      };
    });
  return [side(a, b), side(b, a)];
}

/** Breakdown hours a week for the last 12 weeks, oldest first, from the breakdowns that fell in them. */
export const weekly = (s: Stats): number[] =>
  Array.from({ length: 12 }, (_, i) => {
    const week = WEEKS_SO_FAR - 12 + i;
    const tenths = s.year.breakdowns
      .filter((b) => b.week === week)
      .reduce((t, b) => t + b.tenths, 0);
    return tenths / 10;
  });
