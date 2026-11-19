// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Chart } from './chart.js';
import type { ChartSpec } from './chart-spec.js';

const pair = [
  { name: 'Hours', values: [6, 2] },
  { name: 'Count', values: [3, 1] },
];
const specs: Record<string, ChartSpec> = {
  bar: {
    kind: 'bar',
    title: 'Bar',
    categoryLabel: 'Cell',
    categories: ['Cell 1', 'Cell 2'],
    series: pair,
  },
  'stacked bar': {
    kind: 'bar',
    title: 'Stacked',
    categoryLabel: 'Cell',
    categories: ['Cell 1', 'Cell 2'],
    series: pair,
    stacked: true,
    horizontal: true,
  },
  line: {
    kind: 'line',
    title: 'Line',
    categoryLabel: 'Week',
    categories: ['Cell 1', 'Cell 2'],
    series: pair,
  },
  scatter: {
    kind: 'scatter',
    title: 'Scatter',
    machineLabel: 'Machine',
    xLabel: 'Hours',
    yLabel: 'Count',
    mttrLabel: 'MTTR',
    points: [
      { x: 1, y: 2, r: 5, label: 'Cell 1', mttr: 3 },
      { x: 4, y: 5, r: 5, label: 'Cell 2', mttr: 6 },
    ],
  },
  mixed: {
    kind: 'mixed',
    title: 'Mixed',
    categoryLabel: 'Year',
    categories: ['Cell 1', 'Cell 2'],
    bars: [pair[0]!],
    line: pair[1]!,
  },
  heatmap: {
    kind: 'heatmap',
    title: 'Heat',
    categoryLabel: 'Machine',
    categories: ['Cell 1', 'Cell 2'],
    series: pair,
  },
  pareto: {
    kind: 'pareto',
    title: 'Pareto',
    categoryLabel: 'Cause',
    categories: ['Cell 1', 'Cell 2'],
    series: [pair[0]!],
    cumulativeLabel: 'Cumulative %',
  },
};

describe('Chart keeps "Show the numbers" for every kind', () => {
  it.each(Object.entries(specs))('%s has the numbers table behind the summary', (_name, spec) => {
    const html = renderToStaticMarkup(createElement(Chart, { spec }));
    expect(html).toContain('<details>');
    expect(html).toContain('kit.chart.table');
    expect(html).toContain('<table');
    expect(html).toContain('Cell 1');
    expect(html).toContain('Cell 2');
  });

  it('prints the Pareto table in falling order with the cumulative share, from ascending input', () => {
    const spec: ChartSpec = {
      kind: 'pareto',
      title: 'Pareto',
      categoryLabel: 'Cause',
      categories: ['Cell 1', 'Cell 2'],
      series: [{ name: 'Hours', values: [2, 6] }],
      cumulativeLabel: 'Cumulative %',
    };
    const html = renderToStaticMarkup(createElement(Chart, { spec }));
    expect(html.indexOf('>Cell 2<')).toBeLessThan(html.indexOf('>Cell 1<'));
    expect(html).toContain('>75<');
    expect(html).toContain('>100<');
  });

  it('prints the lane name of each machine on the A9 map', () => {
    const spec: ChartSpec = {
      kind: 'scatter',
      title: 'Map',
      machineLabel: 'Machine',
      xLabel: 'Hours',
      yLabel: 'Rating',
      mttrLabel: 'MTTR',
      yTickLabels: ['Low', 'High'],
      points: [{ x: 1, y: 1, r: 5, label: 'M-1' }],
    };
    const html = renderToStaticMarkup(createElement(Chart, { spec }));
    expect(html).toContain('>Rating<');
    expect(html).toContain('>High<');
  });

  it('prints one table column per heatmap column', () => {
    const html = renderToStaticMarkup(createElement(Chart, { spec: specs.heatmap! }));
    expect(html).toContain('>Hours<');
    expect(html).toContain('>Count<');
  });
});
