// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import type { ChartSpec } from '../chart/use-chart.js';
import { ChartNumbers, NumbersTable } from './chart-numbers.js';

const spec: ChartSpec = {
  kind: 'bar',
  title: 'BD hours by category',
  categoryLabel: 'Category',
  categories: ['Turning Center', 'WaterJet CNC'],
  series: [
    { name: 'BD Hrs', values: [944.19, 1057.7900000000002] },
    { name: '# Breakdowns', values: [271, undefined] },
  ],
};

describe('"Show the numbers" under a chart', () => {
  it('lists every plotted number by category and series, rounded as the pages print them, a gap as a dash', () => {
    const markup = renderToStaticMarkup(h(NumbersTable, { spec }));
    for (const text of ['Category', 'BD Hrs', '# Breakdowns', 'Turning Center', 'WaterJet CNC'])
      expect(markup).toContain(`>${text}<`);
    for (const value of ['944.19', '1,057.79', '271', '—']) expect(markup).toContain(`>${value}<`);
  });

  it('is a closed disclosure that adds no table to the page until it is opened', () => {
    const markup = renderToStaticMarkup(h(ChartNumbers, { spec }));
    expect(markup).toContain('Show the numbers');
    expect(markup).not.toContain('<table');
  });
});
