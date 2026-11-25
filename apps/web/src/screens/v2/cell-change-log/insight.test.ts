// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import '../../../i18n/index.js';
import { fill } from '../../../i18n/fill.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { cellLogModel } from './adapter.js';
import { CellLogView } from './View.js';

/**
 * ADR 0035 (ticket 663): the moves table opens with a takeaway over every move, and both cards name the month before
 * the as-of month as their yardstick. Critical tests only (ADR 0034): the figures, measured on the frozen 11 Nov
 * reply (15 moves: 12 into Cell 9; 3 in October 2026, on 3 machines), never wording.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reader = { codeOf: (id: string) => id, role: 'head', today: '2026-11-11' };
const model = cellLogModel(realReply(), t, reader)!;
const yardstick = (id: string) => model.kpis.find((kpi) => kpi.id === id)?.yardstick ?? '';

describe('Cell Change Log insight (ticket 663)', () => {
  it('opens the moves with a takeaway and names a yardstick on both cards', () => {
    expect(Object.keys(model.takeaways ?? {})).toEqual(['moves']);
    expect(model.takeaways?.moves?.text.length).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('names the cell most moves went to, counted over every move', () => {
    for (const figure of ['9', '8.0', '12'])
      expect(model.takeaways?.moves?.text ?? '').toContain(figure);
  });

  it('measures both cards against October 2026, the month before the figures', () => {
    for (const id of ['moves', 'machines']) {
      expect(yardstick(id), id).toMatch(/Oct/);
      expect(yardstick(id), id).toMatch(/\b3\b/);
    }
  });

  it('draws the takeaway on the page', () => {
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(CellLogView, { model, nav: [], title: 'Cell Change Log' })),
      ),
    );
    expect(html.includes(model.takeaways?.moves?.text ?? '∅')).toBe(true);
  });
});
