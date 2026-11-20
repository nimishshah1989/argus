import { describe, expect, it } from 'vitest';
import type { Palette } from './chart-palette.js';
import { chartOption, type ChartSpec } from './use-chart.js';

const palette: Palette = { series: ['#111111', '#222222'], axis: '#ax', grid: '#gr', font: 'x' };
const line = (extra: Partial<Extract<ChartSpec, { kind: 'line' }>> = {}): ChartSpec => ({
  kind: 'line',
  title: 'Hours',
  categoryLabel: 'Month',
  categories: ['Oct', 'Nov'],
  series: [{ name: 'Breakdown', values: [286, 312] }],
  ...extra,
});
const tooltip = (spec: ChartSpec) =>
  (chartOption(spec, palette) as { tooltip: Record<string, unknown> }).tooltip;

describe('a line chart with a tooltip class', () => {
  it('hands the class to the tooltip and drops its own frame, so the class styles it', () => {
    expect(tooltip(line({ tooltipClass: 'v2-glass-tip' }))).toMatchObject({
      trigger: 'axis',
      axisPointer: { type: 'line' },
      className: 'v2-glass-tip',
      backgroundColor: 'transparent',
      borderWidth: 0,
    });
  });

  it('keeps the usual tooltip when no class is asked for', () => {
    expect(tooltip(line())).toEqual({
      trigger: 'axis',
      axisPointer: { type: 'line' },
      confine: true,
    });
  });
});
