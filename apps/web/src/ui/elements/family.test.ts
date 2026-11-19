// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { familyStep } from './family.js';
import { HeatGrid } from './heat-grid.js';
import { KpiTile } from './kpi-tile.js';
import { Sparkline } from './sparkline.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);
/** What a screen reader reads: all the text. */
const spoken = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('families: identity colour that never replaces the tone', () => {
  const measure = { unit: 'hours', better: 'down' } as const;
  const tile = (over: object = {}) =>
    html(
      createElement(KpiTile, {
        label: 'Downtime',
        value: 5,
        format: (n: number) => `${n} h`,
        verdict: 'On target',
        change: { measure, delta: -2 },
        family: 'downtime',
        ...over,
      }),
    );

  it('keeps the tone in words and icon on a tile that has a family', () => {
    const out = tile();
    expect(spoken(out)).toContain('On target');
    expect(spoken(out)).toContain('Better');
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).toContain('data-family="downtime"');
    expect(out).toContain('data-tone="good"');
  });

  it('is a plain figure without onOpen, and a button that opens a dialog with it', () => {
    expect(tile()).toContain('<dl');
    expect(tile()).not.toContain('<button');
    const open = tile({ onOpen: () => {} });
    expect(open).toMatch(/<button[^>]*aria-haspopup="dialog"/);
    expect(spoken(open)).toContain('Downtime');
    expect(spoken(open)).toContain('5 h');
    expect(spoken(open)).toContain('On target');
  });

  it('draws a sparkline in the family colour and still labels it for a screen reader', () => {
    const out = html(
      createElement(Sparkline, { values: [1, 2, 3], family: 'repairs', label: 'Last 3 months' }),
    );
    expect(out).toContain('aria-label="Last 3 months"');
    expect(out).toContain('--color-family-repairs');
  });
});

describe('heat grid of one family', () => {
  it('shades by the square root of the share of the largest', () => {
    expect([0, 1, 20, 60, 120, 240].map((v) => familyStep(v, 240))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(familyStep(5, 0)).toBe(0);
  });

  it('prints every number whatever its shade, and uses the family ramp', () => {
    const out = html(
      createElement(HeatGrid, {
        label: 'Hours',
        rows: ['Cell 1'],
        columns: ['May', 'Jun', 'Jul'],
        values: [[0, 20, 240]],
        format: (n: number) => `${n} h`,
        family: 'downtime',
      }),
    );
    for (const text of ['0 h', '20 h', '240 h']) expect(spoken(out)).toContain(text);
    expect(out).toContain('--color-family-downtime-ramp-5');
  });
});
