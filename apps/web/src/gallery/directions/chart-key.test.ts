import { describe, expect, it } from 'vitest';
import { chartOption, type ChartSeries, type Palette } from '../../ui/chart/use-chart.js';
import { keySlot, type SeriesChart } from './chart-key.js';

const palette: Palette = {
  series: ['one', 'two'],
  axis: 'a',
  grid: 'g',
  font: 'f',
};
const named = (name: string): ChartSeries => ({ name, values: [1, 2] });

const SPECS: SeriesChart[] = [
  {
    kind: 'bar',
    title: 'Bars',
    categoryLabel: 'Cell',
    categories: ['a', 'b'],
    series: [named('first'), named('second')],
  },
  {
    kind: 'line',
    title: 'Lines',
    categoryLabel: 'Month',
    categories: ['a', 'b'],
    series: [named('first'), named('second'), named('third'), named('fourth')],
  },
  {
    kind: 'mixed',
    title: 'Pareto',
    categoryLabel: 'Problem',
    categories: ['a', 'b'],
    bars: [named('hours')],
    line: named('share'),
  },
];

describe('the key swatch of a framed chart', () => {
  it.each(SPECS)('is the colour the kit draws each series of a $kind chart in', (spec) => {
    const drawn = (chartOption(spec, palette).series as { color: string }[]).map((s) => s.color);
    const keyed = drawn.map((_, i) => palette.series[keySlot(spec, i)]);
    expect(keyed).toEqual(drawn);
  });
});
