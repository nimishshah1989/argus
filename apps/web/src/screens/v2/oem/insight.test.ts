// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../../i18n/index.js';
import { fill } from '../../../i18n/fill.js';
import oem from '../../../../../../fixtures/answer-key/oem-analytics.json' with { type: 'json' };
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { oemModel } from './adapter.js';
import { OemView } from './View.js';

/**
 * ADR 0035 (ticket 664): each of the four tables opens with a takeaway over its Hours column, every row, and each of
 * the six cards names a yardstick. OEM is gallery only (PROJECT.md §4, S18): the lines run over the platform's own page,
 * as `oem.test.ts` builds it. Critical tests only (ADR 0034): the figures, never wording.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const platform: FiguresReply = {
  ...realReply(),
  figures: [
    {
      key: 'oem-analytics',
      screen: 'oem-analytics',
      owner: 36,
      status: 'ready',
      value: oem,
      drill: { type: 'machine', ids: [] },
    },
  ],
};
const model = oemModel(platform, t, { money: true })!;
const SECTIONS = ['machines', 'models', 'repeats', 'breakdowns'];
const has = (text: string | undefined, figures: string[]) => {
  for (const figure of figures) expect(text ?? '').toContain(figure);
};
const yardstick = (at: number) => model.kpis[at]?.yardstick;

describe('OEM insight (ticket 664)', () => {
  it('opens every table with a takeaway and names a yardstick on every card', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('says how few machines, models and breakdowns hold half the hours, over every row', () => {
    has(model.takeaways?.machines?.text, ['4', '24', '54%']);
    has(model.takeaways?.models?.text, ['3', '16', '53%']);
    has(model.takeaways?.breakdowns?.text, ['9', '72', '52%']);
    has(model.takeaways?.repeats?.text, ['Coolant pressure / flow', '1.9', '2.7']);
  });

  it('measures each card: share of the plant, average per young machine, share of the downtime', () => {
    has(yardstick(0), ['19%', '125']);
    has(yardstick(1), ['3.0']);
    has(yardstick(2), ['2.5']);
    has(yardstick(3), ['56%', '59.5']);
    has(yardstick(4), ['11%', '59.5']);
    has(yardstick(5), ['100%', '72']);
  });

  it('draws every takeaway on the page', () => {
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(OemView, { model, nav: [], title: 'OEM' })),
      ),
    );
    for (const id of SECTIONS)
      expect(html.includes(model.takeaways?.[id]?.text ?? '∅'), `${id} drawn`).toBe(true);
  });
});
