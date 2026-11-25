// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { allZero, splitTiles, TileSet, type TileItem } from '../tile-set.js';

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
  },
});

describe('TileSet: edges', () => {
  it('an empty set or a NaN is not all zero', () => {
    expect(allZero([])).toBe(false);
    expect(allZero([tile('A', 0), tile('B', Number.NaN)])).toBe(false);
    expect(allZero([tile('A', 0), tile('B', 1)])).toBe(false);
  });
  it('exactly 4 tiles need no disclosure', () => {
    const items = ['A', 'B', 'C', 'D'].map((l) => tile(l, 1));
    expect(splitTiles(items).folded).toEqual([]);
    expect(renderToStaticMarkup(createElement(TileSet, { items }))).not.toContain('<details');
  });
  it('honours a smaller max', () => {
    expect(splitTiles([tile('A', 1), tile('B', 2)], 1).folded.map((x) => x.kpi.label)).toEqual([
      'B',
    ]);
  });
});
