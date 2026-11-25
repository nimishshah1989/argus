// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import type { KpiData } from './kpi-card.js';
import { allZero, splitTiles, TileSet, type TileItem } from './tile-set.js';

const tile = (label: string, n: number): TileItem => ({
  n,
  kpi: {
    id: label,
    label,
    icon: 'reliability',
    value: String(n),
    delta: { text: '', up: false, good: true },
    period: '',
    meaning: '',
    more: '',
  } satisfies KpiData,
});

describe('TileSet (ADR 0036 R1, R10)', () => {
  it('collapses tiles that are all zero into one line', () => {
    const items = [tile('Breakdowns', 0), tile('PM misses', 0)];
    expect(allZero(items)).toBe(true);
    const html = renderToStaticMarkup(createElement(TileSet, { items }));
    expect(html).toContain('<p class="v2-zero-line">All 2 are zero: Breakdowns, PM misses.</p>');
    expect(html).not.toContain('v2-kpi');
  });

  it('keeps 4 tiles above the fold and puts the rest under Show detail', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F'].map((l, i) => tile(l, i + 1));
    const { shown, folded } = splitTiles(items);
    expect(shown.map((x) => x.kpi.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(folded.map((x) => x.kpi.label)).toEqual(['E', 'F']);
    const html = renderToStaticMarkup(createElement(TileSet, { items }));
    expect(html).toMatch(
      /<details class="v2-show-detail"><summary>Show detail<\/summary>.*aria-label="E"/,
    );
  });
});
