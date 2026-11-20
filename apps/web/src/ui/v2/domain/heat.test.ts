// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ratio, readTokens, resolve } from '../../contrast.js';
import { DrillOpenContext } from '../drill.js';
import { HeatMatrix, levelOf, type HeatMatrixData } from './heat-matrix.js';
import { HeatTiles } from './heat-tiles.js';

const tokensCss = readFileSync(new URL('../../tokens.css', import.meta.url), 'utf8');
const heatCss = readFileSync(new URL('../heat.css', import.meta.url), 'utf8');
const words = { low: 'Fewer hours', high: 'More hours' };

/** The colour `color-mix(in srgb, fill P%, panel)` paints, as hex, so the contrast of ink on it can be measured. */
function mixed(fill: string, over: string, percent: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const part = (at: number) =>
    Math.round((channel(fill, at) * percent + channel(over, at) * (100 - percent)) / 100)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

describe('the heat scale', () => {
  it('puts the lowest value on step 1, the highest on step 5, and a range with no spread on the middle', () => {
    expect(levelOf(0, 0, 100)).toBe(1);
    expect(levelOf(100, 0, 100)).toBe(5);
    expect(levelOf(50, 0, 100)).toBe(3);
    expect(levelOf(7, 7, 7)).toBe(3);
  });

  it('spreads a range where a few cells dwarf the rest, so the middle still shows its weight', () => {
    expect(levelOf(10, 0, 100)).toBe(1);
    expect(levelOf(10, 0, 100, true)).toBe(2);
    expect(levelOf(100, 0, 100, true)).toBe(5);
  });

  for (const [theme, set] of Object.entries(readTokens(tokensCss))) {
    it(`keeps the ink readable at 4.5:1 on every step in ${theme}`, () => {
      const steps = [...heatCss.matchAll(/--v2-heat-(\d):\s*(\d+)%;/g)].map((m) => Number(m[2]));
      expect(steps).toHaveLength(5);
      const [fill, panel, ink] = ['plan-fill', 'panel', 'ink'].map((k) =>
        resolve(set, `color-v2-${k}`),
      );
      for (const percent of steps)
        expect(ratio(ink!, mixed(fill!, panel!, percent)), `${percent}%`).toBeGreaterThanOrEqual(
          4.5,
        );
    });
  }
});

const matrix: HeatMatrixData = {
  id: 'm',
  title: 'By machine — BD hours by month',
  header: { first: 'Machine', cells: ['Jan', 'Feb'], plain: ['Total'] },
  rows: [
    {
      head: 'TMC-2',
      chip: { kind: 'machine', id: 'TMC-2', label: 'TMC-2' },
      cells: [
        { text: '242.42', level: 5, name: 'TMC-2, Jan: 242.42' },
        { text: '—', level: null, name: 'TMC-2, Feb: no hours' },
      ],
      plain: ['242.42'],
    },
  ],
};

describe('the heat matrix', () => {
  const html = renderToStaticMarkup(h(HeatMatrix, { matrix, words }));

  it('prints every figure and names each cell by its row and month, so the tint is never the only sign', () => {
    expect(html).toContain('>242.42<');
    expect(html).toContain('aria-label="TMC-2, Jan: 242.42"');
    expect(html).toContain('<caption>By machine — BD hours by month</caption>');
    expect(html).toContain('scope="row"');
  });

  it('tints a cell with hours and leaves a month with none a plain dash, and says which way the tint runs', () => {
    expect(html).toContain('data-level="5" title="TMC-2, Jan: 242.42"');
    expect(html).not.toContain('data-level="5" title="TMC-2, Feb');
    expect(html).toContain('Fewer hours');
    expect(html).toContain('More hours');
  });
});

describe('the heat tiles', () => {
  const tile = {
    id: 'cell:1',
    name: 'Cell 1',
    value: '170.0',
    unit: 'Connected KVA',
    lines: ['8 machines'],
    level: 2 as const,
    summary: 'Cell 1: 170.0 Connected KVA. 8 machines',
  };
  const html = renderToStaticMarkup(
    h(
      DrillOpenContext.Provider,
      { value: () => {} },
      h(HeatTiles, {
        title: 'Load by Cell',
        words,
        tiles: [
          {
            ...tile,
            drill: { figure: 'a5-energy:cell:1', label: 'Show the machines behind Cell 1' },
          },
          { ...tile, id: 'cell:2', name: 'Cell 2', level: null, summary: 'Cell 2. No machines' },
        ],
      }),
    ),
  );

  it('makes a tile with machines behind it a button named by its figure and what it opens, and any other tile plain', () => {
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain(
      'aria-label="Cell 1: 170.0 Connected KVA. 8 machines. Show the machines behind Cell 1"',
    );
    expect(html).toContain('data-empty=""');
  });
});
