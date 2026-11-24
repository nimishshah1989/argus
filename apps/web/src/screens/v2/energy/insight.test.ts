// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realReply } from '../figures/real-reply.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { realT } from '../printed-page/test-support.js';
import { energyModel } from './adapter.js';
import { EnergyView } from './View.js';

/**
 * ADR 0035 (ticket 660): each of the three maps opens with a takeaway over its tiles, and each figure tile names a
 * yardstick. Critical tests only (ADR 0034): the figures in each line, measured on the frozen 11 Nov reply, never wording.
 */
const model = energyModel(realReply(), realT)!;
const SECTIONS = ['cell', 'location', 'machine'];
const yardstick = (id: string) => model.figures.find((f) => f.id === id)?.yardstick ?? '';
const has = (text: string | undefined, figures: string[]) => {
  for (const figure of figures) expect(text ?? '').toContain(figure);
};

describe('Energy insight (ticket 660)', () => {
  it('opens every map with a takeaway and names a yardstick on every figure tile', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('says how few cells hold half the connected load, and which location stands out', () => {
    has(model.takeaways?.cell?.text, ['3', '9', '52%']);
    has(model.takeaways?.location?.text, ['Location 434', '2.3', '782.0']);
  });

  it('names no outlier on the per-machine map, where no cell is 1.5× the others', () => {
    expect(model.takeaways?.machine?.text.length).toBeGreaterThan(0);
    expect(model.takeaways?.machine?.outlier).toBeUndefined();
  });

  it('measures each tile: the plant average per machine, and the share of the connected load', () => {
    has(yardstick('connected'), ['22.3']);
    has(yardstick('running'), ['20%', '2,812.0']);
    has(yardstick('heaviest'), ['18%', '2,812.0']);
    has(yardstick('densest'), ['22.3']);
  });

  it('draws every takeaway on the page', () => {
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(EnergyView, { model, nav: [], title: 'Energy' })),
      ),
    );
    for (const id of SECTIONS)
      expect(html.includes(model.takeaways?.[id]?.text ?? '∅'), `${id} drawn`).toBe(true);
  });
});
