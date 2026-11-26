import { describe, expect, it } from 'vitest';
import { yearsFrom } from '../../analytics-figures.js';
import { yearsMeaning } from '../../screens/v2/live-frame.js';
import { lineOption } from './option-lines.js';
import { yearOverYear } from './year-over-year.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const across = (years: number[]) =>
  years.flatMap((year) => MONTHS.map((m) => `${m} ${String(year % 100).padStart(2, '0')}`));

describe('year over year (ADR 0063)', () => {
  it('redraws months over several years as one line per year on Jan–Dec, the latest marked', () => {
    const categories = across([2024, 2025]).slice(0, 23);
    const values = categories.map((_, i) => i + 1);
    const out = yearOverYear({ categories, series: [{ name: 'BD Hrs', values }] });
    expect(out?.categories).toEqual(MONTHS);
    expect(out?.series.map((s) => [s.name, s.current])).toEqual([
      ['BD Hrs 2024', false],
      ['BD Hrs 2025', true],
    ]);
    expect(out?.series[1]?.values[0]).toBe(13);
    expect(out?.series[1]?.values[11]).toBeUndefined();
  });

  it('leaves a one-year chart, a forecast that only crosses New Year, and other axes as they were', () => {
    const series = [{ name: 'x', values: [1, 2, 3] }];
    expect(yearOverYear({ categories: ['Jan', 'Feb', 'Mar'], series })).toBeNull();
    expect(yearOverYear({ categories: ['Nov 26', 'Dec 26', 'Jan 27'], series })).toBeNull();
    expect(yearOverYear({ categories: ['VMC-01', 'VMC-02', 'VMC-03'], series })).toBeNull();
  });

  it('drops a year with nothing recorded and keeps each line on its series axis', () => {
    const categories = across([2022, 2023, 2024]);
    const values = categories.map((label) => (label.endsWith('23') ? null : 1)) as number[];
    const out = yearOverYear({ categories, series: [{ name: 'MTTR', values }] });
    expect(out?.series.map((s) => s.year)).toEqual([2022, 2024]);
    const option = lineOption(
      {
        kind: 'line',
        title: 't',
        categoryLabel: 'Month',
        categories,
        secondAxis: true,
        series: [
          { name: 'MTTR', values },
          { name: 'MTBF', values },
        ],
      },
      { series: ['a', 'b', 'c'], axis: 'x', grid: 'y', font: 'f', width: 600 },
    ) as { series: { name: string; yAxisIndex?: number }[]; legend?: unknown };
    expect(option.legend).toBeDefined();
    expect(option.series.map((s) => [s.name, s.yAxisIndex ?? 0])).toEqual([
      ['MTTR 2022', 0],
      ['MTTR 2024', 0],
      ['MTBF 2022', 1],
      ['MTBF 2024', 1],
    ]);
  });
});

describe('the year choice in the address (ADR 0063)', () => {
  it('reads a year, a range or all, and treats anything else as the default', () => {
    expect(yearsFrom('?years=2024')).toBe('2024');
    expect(yearsFrom('?screen=x&years=2022-2026')).toBe('2022-2026');
    expect(yearsFrom('years=all')).toBe('all');
    for (const bad of ['', '?years=', '?years=2026-2024', '?years=ALL', '?years=24'])
      expect(yearsFrom(bad)).toBeNull();
  });

  it('says which screens the years move, and which read the day or every year instead', () => {
    expect(yearsMeaning('a1-bd-pm')).toBe('span');
    expect(yearsMeaning('dashboard')).toBe('span');
    expect(yearsMeaning('registers')).toBe('asOf');
    expect(yearsMeaning('forecast-lab')).toBe('history');
    expect(yearsMeaning('guide')).toBeNull();
  });
});
