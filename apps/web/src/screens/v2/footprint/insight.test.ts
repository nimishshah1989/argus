// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import '../../../i18n/index.js';
import { fill } from '../../../i18n/fill.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { footprintModel } from './adapter.js';
import { FootprintView } from './View.js';

/**
 * Ticket 656 (ADR 0035): each footprint table opens with a kit line over its area column, and every card names a
 * yardstick (share or the year before). Critical tests only (ADR 0034): figures, not wording or tone. Frozen 11 Nov.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const model = footprintModel(realReply(), t)!;

/** Each section and the figures its line must carry. */
const SECTIONS: Record<string, string[]> = {
  'Average Footprint by Category': ['2', '14', '64%'],
  'Footprint — by Cell': ['3', '9', '51%'],
  'Footprint — by Location': ['434', '2.5', '457.4'],
  'Footprint Growth by Purchase Year': ['4', '22', '56%'],
  '10 Largest Footprints': ['WJ-01', '1.9', '61.0'],
};

/** Each card and the figures its yardstick must carry. */
const YARDSTICKS: Record<string, string[]> = {
  'fp-0': ['100%', '125'],
  'fp-1': ['2025', '1,284.3'],
  'fp-2': ['191%', '1,553'],
  'fp-3': ['52%', '2,970'],
  'fp-4': ['2025', '12.8'],
};

describe('Footprint insight (ticket 656)', () => {
  it('gives every table a takeaway, keyed by the table', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(Object.keys(SECTIONS).sort());
    expect(model.tables.map((table) => table.id).sort()).toEqual(Object.keys(SECTIONS).sort());
    for (const id of Object.keys(SECTIONS))
      expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
  });

  it('says where the area sits in each table, from the whole table', () => {
    for (const [id, figures] of Object.entries(SECTIONS))
      for (const figure of figures) expect(model.takeaways?.[id]?.text ?? '', id).toContain(figure);
  });

  it('gives every card a yardstick with the figure it is measured against', () => {
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    for (const [id, figures] of Object.entries(YARDSTICKS)) {
      const card = model.kpis.find((kpi) => kpi.id === id);
      for (const figure of figures) expect(card?.yardstick ?? '', id).toContain(figure);
    }
  });

  it('draws the screen with its takeaways and yardsticks', () => {
    const nav = [
      { id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
    ];
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(FootprintView, { model, nav, title: 'F' })),
    );
    for (const id of Object.keys(SECTIONS))
      expect(html, id).toContain(model.takeaways?.[id]?.text ?? `no takeaway for ${id}`);
    expect(html).toContain('191%');
  });
});
