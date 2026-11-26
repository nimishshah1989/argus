import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { drawnChart } from './key-chart.js';

describe('the chart a key page draws', () => {
  const line: ChartSpec = {
    kind: 'line',
    title: 'Hours',
    categoryLabel: 'Month',
    categories: ['Jan', 'Feb'],
    series: [{ name: 'BD hours', values: [1, 2] }],
  };

  it('draws in once, and names the value axis after a lone series', () => {
    expect(drawnChart(line)).toMatchObject({ draw: true, legend: false, valueLabel: 'BD hours' });
  });

  it('shows a legend from two series up and keeps a title the spec already has', () => {
    const two: ChartSpec = {
      ...line,
      valueLabel: 'Hours',
      series: [...line.series, { name: 'Count', values: [3, 4] }],
    };
    expect(drawnChart(two)).toMatchObject({
      title: 'Hours',
      draw: true,
      legend: true,
      valueLabel: 'Hours',
    });
  });

  it('leaves a scatter as it came', () => {
    const scatter: ChartSpec = {
      kind: 'scatter',
      title: 'x',
      machineLabel: 'm',
      xLabel: 'x',
      yLabel: 'y',
      mttrLabel: 't',
      points: [],
    };
    expect(drawnChart(scatter)).toBe(scatter);
  });
});
