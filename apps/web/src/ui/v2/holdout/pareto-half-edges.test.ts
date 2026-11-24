// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { Pareto, type ParetoData } from '../pareto.js';

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

/** x of every vertical line that is not the half marker (the split line). */
const splitXs = (html: string) =>
  [...html.matchAll(/<line([^>]*)\/?>/g)]
    .map((m) => m[1]!)
    .filter((a) => !a.includes('data-half'))
    .map((a) => [/ x1="([^"]+)"/.exec(a)?.[1], / x2="([^"]+)"/.exec(a)?.[1]])
    .filter(([x1, x2]) => x1 !== undefined && x1 === x2)
    .map(([x1]) => Number(x1));
const rectXs = (html: string) =>
  [...html.matchAll(/<rect[^>]* x="([^"]+)"/g)].map((m) => Number(m[1]));

describe('Pareto half: edges', () => {
  it('a zero total has no bad bars and no marker', () => {
    const html = render(paretoOf([bar('A', 0), bar('B', 0)], 1));
    expect(badBars(html)).toEqual([]);
    expect(count(html, 'data-half')).toBe(0);
  });

  it('a trailing rest bar is never bad', () => {
    const big = render(paretoOf([bar('A', 10), bar('B', 5), bar('Rest', 50, true)], 1));
    expect(badBars(big)).toEqual([]);
    expect(count(big, 'data-half')).toBe(0);
    const small = render(paretoOf([bar('A', 60), bar('B', 10), bar('Rest', 30, true)], 2));
    expect(badBars(small)).toEqual(['A']);
  });

  it('keeps the split line after the first `top` bars, apart from the half', () => {
    const html = render(paretoOf([bar('A', 60), bar('B', 20), bar('C', 15), bar('D', 5)], 3));
    const xs = rectXs(html);
    const split = splitXs(html);
    expect(split).toHaveLength(1);
    expect(split[0]).toBeGreaterThan(xs[2]!);
    expect(split[0]).toBeLessThan(xs[3]!);
    expect(badBars(html)).toEqual(['A']);
  });
});
