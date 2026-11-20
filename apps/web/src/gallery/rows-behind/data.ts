import { fill } from '../../i18n/fill.js';
import type { BulletData } from '../../ui/v2/bullet-bar.js';
import type { Drill } from '../../ui/v2/drill.js';
import type { KpiData } from '../../ui/v2/kpi-card.js';
import type { ParetoData } from '../../ui/v2/pareto.js';
import replies from './generated/replies.json' with { type: 'json' };
import { figureLabels, openLabel, viewWords } from './words.js';

type Entry = { value: unknown; reply: unknown };
const figures = replies.figures as Record<string, Entry>;
const indian = (n: number, digits = 0) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** A figure's value as the screen prints it: the engine's number, grouped the Indian way, with its unit. */
export function printed(key: string): string {
  const value = figures[key]?.value;
  if (key === 'dashboard.pm-hours') return `${indian(Number(value), 1)} hrs`;
  if (key === 'dashboard.breakdown-free') {
    const v = value as { runningClean: number; inService: number };
    return `${v.runningClean} of ${v.inService}`;
  }
  if (key === 'cell-change-log') return indian((value as { moves: unknown[] }).moves.length);
  return indian(Number(value));
}

/** The control that opens a figure's rows, named in the reader's words. */
export const drillOf = (key: string): Drill => ({
  figure: key,
  label: fill(openLabel, { figure: figureLabels[key] ?? key }),
});

const w = viewWords;
export const kpis: KpiData[] = [
  {
    id: 'pm-hours',
    label: figureLabels['dashboard.pm-hours']!,
    icon: 'wrench',
    value: printed('dashboard.pm-hours'),
    delta: { text: w.noChange, up: true, good: true, flat: true },
    period: w.period,
    meaning: w.pmMeaning,
    more: w.pmMore,
    drill: drillOf('dashboard.pm-hours'),
  },
  {
    id: 'moves',
    label: figureLabels['cell-change-log']!,
    icon: 'cell',
    value: printed('cell-change-log'),
    delta: { text: w.noChange, up: true, good: true, flat: true },
    period: w.period,
    meaning: w.movesMeaning,
    more: w.movesMore,
    drill: drillOf('cell-change-log'),
  },
];

const BARS = ['dashboard.process-machines', 'dashboard.conventional-machines', 'dashboard.dg-sets'];
export const pareto: ParetoData = {
  bars: BARS.map((key) => ({
    label: figureLabels[key]!,
    hours: Number(figures[key]?.value),
    shown: printed(key),
    drill: drillOf(key),
  })),
  top: 2,
  total: BARS.reduce((sum, key) => sum + Number(figures[key]?.value), 0),
  aria: w.paretoAria,
  conclusion: [{ text: w.paretoConclusion }],
  why: [[{ text: w.paretoWhy }]],
};

const FREE = figures['dashboard.breakdown-free']?.value as {
  runningClean: number;
  inService: number;
};
export const bullet: BulletData = {
  id: 'free',
  label: figureLabels['dashboard.breakdown-free']!,
  shown: printed('dashboard.breakdown-free'),
  unit: '',
  value: FREE.runningClean,
  target: 100,
  lastMonth: 49,
  scale: [0, FREE.inService],
  higherIsBetter: true,
  met: false,
  verdict: w.bulletVerdict,
  aria: w.bulletAria,
  why: [[{ text: w.bulletWhy }]],
  drill: drillOf('dashboard.breakdown-free'),
};
