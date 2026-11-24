// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';
import { ShiftKpisView } from './View.js';

/** ADR 0033: the drawn page says each sentence once. Counted in the markup, so a kit or View repeat fails here. */
const model = shiftKpisModel(realReply(), realT)!;
const html = renderToStaticMarkup(
  h(
    QueryClientProvider,
    { client: new QueryClient() },
    h(MemoryRouter, null, h(ShiftKpisView, { model, nav: [], title: 'Shift-calendar KPIs' })),
  ),
);
const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** How many elements print exactly this text. */
const printed = (text: string) => html.split(`>${esc(text)}<`).length - 1;

describe('Shift-calendar KPIs page says each sentence once (ticket 642)', () => {
  it('prints each tile’s basis line once per tile, not again as its yardstick', () => {
    const tiles = model.sections.flatMap((s) => s.figures);
    expect(tiles.length).toBeGreaterThan(0);
    for (const sub of new Set(tiles.map((tile) => tile.sub))) {
      expect(printed(sub), sub).toBe(tiles.filter((tile) => tile.sub === sub).length);
    }
  });

  it('prints "Not computed yet" once for each section the engine did not compute', () => {
    const missing = model.sections.filter((s) => s.notComputed).length;
    expect(missing).toBeGreaterThan(0);
    expect(html.split('Not computed yet').length - 1).toBe(missing);
  });

  it('prints the headline and the half-the-hours line once each', () => {
    expect(html.split('hrs between breakdowns').length - 1).toBe(1);
    expect(html.split('Half of the breakdown hours come from').length - 1).toBe(1);
  });
});
