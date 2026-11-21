// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartOption } from './chart-option.js';
import type { Palette } from './chart-palette.js';
import type { ChartSpec } from './chart-spec.js';

const palette: Palette = {
  series: ['#a1', '#a2', '#a3', '#a4'],
  axis: '#ax',
  grid: '#gr',
  font: 'x',
};
const series = [{ name: 'Hours', values: [6, 2] }];
const bar: ChartSpec = {
  kind: 'bar',
  title: 'Bar',
  categoryLabel: 'Cell',
  categories: ['A', 'B'],
  series,
  valueLabel: 'Hours',
};
const line: ChartSpec = { ...bar, kind: 'line', categoryLabel: 'Week' } as ChartSpec;

interface View {
  xAxis?: { name?: string };
  yAxis?: { name?: string };
  grid?: { bottom?: number };
}
const view = (spec: ChartSpec) => chartOption(spec, palette) as unknown as View;

describe('chart axis titles', () => {
  it('leaves the category axis unnamed unless asked, as before', () => {
    expect(view(bar).xAxis?.name).toBeUndefined();
    expect(view(line).xAxis?.name).toBeUndefined();
    expect(view(bar).grid?.bottom).toBe(8);
  });

  it('names the category axis with the spec category label on a bar and a line, and makes room for it', () => {
    const asked = view({ ...bar, axisTitles: true } as ChartSpec);
    expect(asked.xAxis?.name).toBe('Cell');
    expect(asked.yAxis?.name).toBe('Hours');
    expect(asked.grid?.bottom).toBeGreaterThan(8);
    const lined = view({ ...line, axisTitles: true } as ChartSpec);
    expect(lined.xAxis?.name).toBe('Week');
    expect(lined.grid?.bottom).toBeGreaterThan(8);
  });

  it('keeps the long labels of a horizontal bar clear: only the value axis is named', () => {
    const asked = view({ ...bar, axisTitles: true, horizontal: true } as ChartSpec);
    expect(asked.xAxis?.name).toBe('Hours');
    expect(asked.yAxis?.name).toBeUndefined();
    // The value axis title sits under the plot, so the plot leaves room for it.
    expect(asked.grid?.bottom).toBe(36);
  });
});
