// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { Pareto, type ParetoData } from './pareto.js';

const paretoOf = (bars: ParetoData['bars'], top: number): ParetoData => ({
  bars,
  top,
  total: bars.reduce((s, b) => s + b.hours, 0),
  aria: 'Lost hours by cause',
  conclusion: [],
  why: [],
});
const bar = (label: string, hours: number, rest?: boolean): ParetoData['bars'][number] => ({
  label,
  hours,
  shown: `${hours} h`,
  ...(rest ? { rest } : {}),
});
const render = (data: ParetoData) =>
  renderToStaticMarkup(createElement(Pareto, { data, whyLabel: 'Why', actions: null }));
/** Each bar's title and whether it is marked bad. */
const badBars = (html: string) =>
  [...html.matchAll(/<rect([^>]*)>\s*<title>([^<]*)<\/title>/g)]
    .filter((m) => m[1]!.includes('data-status="bad"'))
    .map((m) => m[2]);
const count = (html: string, s: string) => html.split(s).length - 1;

describe('Pareto as ranked bars with a half marker (ADR 0036 R20)', () => {
  const data = paretoOf(
    [bar('Spindle', 40), bar('Hydraulics', 30), bar('Coolant', 20), bar('Other', 10)],
    1,
  );

  it('draws no running-total line', () => {
    const chart = /<svg[^>]*role="img"[\s\S]*?<\/svg>/.exec(render(data))?.[0];
    expect(chart).toBeDefined();
    expect(chart).not.toContain('<polyline');
    expect(chart).not.toContain('<path');
  });

  it('marks the bars that make up half the hours bad, and only those', () => {
    expect(badBars(render(data))).toEqual(['Spindle', 'Hydraulics']);
  });

  it('puts one half marker in the chart', () => {
    expect(count(render(data), 'data-half')).toBe(1);
  });
});
