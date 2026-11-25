// @vitest-environment node
import { insightEn } from '@uptimo/shared/i18n/insight.en';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { halfBars, RankedBars, rankRows, type RankedRow } from '../ranked-bars.js';

const row = (key: string, value: number, extra: Partial<RankedRow> = {}): RankedRow => ({
  key,
  label: key,
  value,
  valueText: `${value} h`,
  ...extra,
});
const marker = `aria-label="${insightEn['insight.half']}"`;

describe('RankedBars: edges', () => {
  it('keeps ties in their input order', () => {
    expect(
      rankRows([row('A', 5), row('B', 9), row('C', 5), row('D', 5)]).map((r) => r.key),
    ).toEqual(['B', 'A', 'C', 'D']);
  });

  it('puts negative and NaN values last with share 0', () => {
    const ranked = rankRows([row('N', Number.NaN), row('A', 30), row('M', -4), row('B', 10)]);
    expect(ranked.map((r) => r.key)).toEqual(['A', 'B', 'N', 'M']);
    expect(ranked.map((r) => r.share)).toEqual([0.75, 0.25, 0, 0]);
    expect(ranked.map((r) => r.width)).toEqual([1, 1 / 3, 0, 0]);
    expect(halfBars([30, Number.NaN, -4, 10])).toBe(1);
  });

  it('a total of 0 has no half and no marker', () => {
    expect(halfBars([])).toBe(0);
    expect(halfBars([0, 0])).toBe(0);
    expect(rankRows([row('A', 0), row('B', 0)]).map((r) => r.share)).toEqual([0, 0]);
    const html = renderToStaticMarkup(
      createElement(RankedBars, { rows: [row('A', 0), row('B', 0)], label: 'x' }),
    );
    expect(html).not.toContain(marker);
  });

  it('a rest row goes last and is never inside the half', () => {
    const ranked = rankRows([row('Rest', 60, { rest: true }), row('A', 30), row('B', 10)]);
    expect(ranked.map((r) => r.key)).toEqual(['A', 'B', 'Rest']);
    expect(ranked.map((r) => r.share)).toEqual([0.3, 0.1, 0.6]);
    expect(halfBars([30, 10, 60], [false, false, true])).toBe(0);
    expect(halfBars([60, 10, 30], [false, false, true])).toBe(1);
    const rows = [row('A', 40), row('B', 5), row('Rest', 55, { rest: true })];
    const html = renderToStaticMarkup(createElement(RankedBars, { rows, label: 'x' }));
    expect(html).not.toContain(marker);
  });
});
