import type { ChartSpec } from '../../ui/chart/use-chart.js';

/** The chart kinds that read as categories down and series across; a scatter has no key or table here. */
export type SeriesChart = Exclude<ChartSpec, { kind: 'scatter' }>;

/**
 * Which of the kit's two chart colours (0 is `--color-chart-1`, 1 is `--color-chart-2`) the kit draws series `i`
 * in. A key swatch reads this, so it can never show a colour the chart does not use: bars and lines alternate,
 * and a mixed chart draws every bar in the first and its line in the second.
 */
export function keySlot(spec: SeriesChart, i: number): 0 | 1 {
  if (spec.kind === 'mixed') return i < spec.bars.length ? 0 : 1;
  return i % 2 === 0 ? 0 : 1;
}
