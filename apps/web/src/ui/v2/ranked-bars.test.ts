// @vitest-environment node
import { insightEn } from '@uptimo/shared/i18n/insight.en';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { halfBars, RankedBars, rankRows, type RankedRow } from './ranked-bars.js';

const row = (key: string, value: number, extra: Partial<RankedRow> = {}): RankedRow => ({
  key,
  label: key,
  value,
  valueText: `${value} h`,
  ...extra,
});

describe('RankedBars (ADR 0036 R20, R12)', () => {
  it('ranks worst first with each share of the total and a bar against the largest', () => {
    const ranked = rankRows([row('B', 20), row('A', 50), row('C', 30)]);
    expect(ranked.map((r) => r.key)).toEqual(['A', 'C', 'B']);
    expect(ranked.map((r) => r.share)).toEqual([0.5, 0.3, 0.2]);
    expect(ranked.map((r) => r.width)).toEqual([1, 0.6, 0.4]);
  });

  it('counts the fewest leading values that reach half the total', () => {
    expect(halfBars([50, 30, 20])).toBe(1);
    expect(halfBars([40, 30, 20, 10])).toBe(2);
    expect(halfBars([10, 10, 10, 10])).toBe(2);
  });

  it('prints value · share · count, ₹ after it, and marks half after the rows that make it', () => {
    const rows = [
      row('Spindle', 30, { countText: '3 entries', moneyText: '₹ 1.20 lakh' }),
      row('Hydraulics', 40, { countText: '5 entries' }),
      row('Coolant', 20),
      row('Other', 10),
    ];
    const html = renderToStaticMarkup(createElement(RankedBars, { rows, label: 'Lost hours' }));
    expect(html).toContain('40 h · 40% · 5 entries');
    expect(html).toContain('30 h · 30% · 3 entries');
    expect(html).toContain('₹ 1.20 lakh');
    expect(html).toContain('20 h · 20%');
    const marker = `aria-label="${insightEn['insight.half']}"`;
    expect(html.split(marker)).toHaveLength(2);
    const [before, after] = html.split(marker) as [string, string];
    expect(before).toContain('Hydraulics');
    expect(before).toContain('Spindle');
    expect(after).toContain('Coolant');
    expect(after).toContain('Other');
  });
});
