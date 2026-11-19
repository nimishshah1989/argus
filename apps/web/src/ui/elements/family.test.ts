// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { familyStep } from './family.js';
import { HeatGrid, heatLevel } from './heat-grid.js';
import { KpiTile } from './kpi-tile.js';
import { Sparkline } from './sparkline.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);
/** What a screen reader reads: all the text. */
const spoken = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const icons = (markup: string) => markup.match(/<svg/g)?.length ?? 0;

describe('families: identity colour that never replaces the tone', () => {
  const measure = { unit: 'hours', better: 'down' } as const;
  const props = {
    label: 'Downtime',
    value: 5,
    format: (n: number) => `${n} h`,
    verdict: 'On target',
    change: { measure, delta: -2 },
  };
  const tile = (over: object = {}) => html(createElement(KpiTile, { ...props, ...over }));

  it('says the tone in words and shows its icon on a tile that has a family, as on one without', () => {
    const plain = tile();
    const withFamily = tile({ family: 'downtime' });
    for (const out of [plain, withFamily]) {
      expect(spoken(out)).toContain('On target');
      expect(spoken(out)).toContain('Better');
    }
    expect(icons(withFamily)).toBe(icons(plain));
    expect(icons(withFamily)).toBeGreaterThanOrEqual(2); // the verdict's and the change's
  });

  it('is a plain figure without onOpen, and a button that says everything the plain tile says', () => {
    const plain = tile();
    expect(plain).not.toContain('<button');
    const open = tile({ onOpen: () => {} });
    expect(open).toMatch(/<button[^>]*aria-haspopup="dialog"/);
    for (const text of ['Downtime', '5 h', 'On target', 'Better'])
      expect(spoken(open)).toContain(text);
  });

  it('shows a mark that a tap goes somewhere only on a tile that opens', () => {
    expect(icons(tile({ onOpen: () => {} }))).toBe(icons(tile()) + 1);
  });

  it('draws a sparkline for a family and still labels it for a screen reader', () => {
    const out = html(
      createElement(Sparkline, { values: [1, 2, 3], family: 'repairs', label: 'Last 3 months' }),
    );
    expect(out).toContain('aria-label="Last 3 months"');
  });
});

describe('heat grid of one family', () => {
  it('shades by the square root of the share of the largest', () => {
    expect([0, 1, 20, 60, 120, 240].map((v) => familyStep(v, 240))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('gives no shade to a value that is not a usable number', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -4])
      expect(familyStep(bad, 240)).toBe(0);
    expect(familyStep(5, 0)).toBe(0);
    expect(familyStep(5, Number.NaN)).toBe(0);
    expect(heatLevel(Number.NaN, 0, 10)).toBe(0);
  });

  const grid = (values: (number | undefined)[][], family?: 'downtime') =>
    html(
      createElement(HeatGrid, {
        label: 'Hours',
        rows: ['Cell 1'],
        columns: ['May', 'Jun', 'Jul', 'Aug'],
        values,
        format: (n: number) => `${n} h`,
        family,
      }),
    );

  it('prints every number whatever its shade', () => {
    const out = grid([[0, 20, 240, 5]], 'downtime');
    for (const text of ['0 h', '20 h', '240 h', '5 h']) expect(spoken(out)).toContain(text);
  });

  it('prints an em dash, not 0, for a missing or unusable value', () => {
    for (const family of [undefined, 'downtime' as const]) {
      const out = spoken(grid([[undefined, Number.NaN, 30, 60]], family));
      expect(out.match(/—/g)).toHaveLength(2);
      expect(out).not.toMatch(/(^|\s)0 h/);
      expect(out).not.toContain('NaN');
    }
  });
});
