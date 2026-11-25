// @vitest-environment node
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { bottleneckModel, FIGURE } from '../bottleneck/adapter.js';
import { BottleneckView } from '../bottleneck/View.js';
import { mttrMtbfModel } from '../mttr-mtbf/adapter.js';
import { MttrMtbfView } from '../mttr-mtbf/View.js';
import { answerKey, realT, testT } from './test-support.js';
import type { PrintedPageModel } from './page-model.js';

/**
 * #752 review: on MTTR/MTBF and Bottleneck the figures past the first four fold right under the tiles (PageBody's
 * `fold` slot), as on Fix Finder and Problem Analysis, not below the tables.
 */
const draw = (view: ReactElement) =>
  renderToStaticMarkup(
    h(QueryClientProvider, { client: new QueryClient() }, h(MemoryRouter, null, view)),
  );
const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const at = (html: string, label: string) => html.indexOf(`aria-label="${esc(label)}"`);
/** Where the page's first chart or table card starts: everything above it is the verdict and the tiles. */
const firstCard = (html: string, model: PrintedPageModel) =>
  Math.min(
    ...[...model.charts.map((c) => c.spec.title), ...model.tables.map((t) => t.title)]
      .map((title) => at(html, title))
      .filter((i) => i >= 0),
  );

const bottleneck = bottleneckModel(
  answerKey('a9-bottleneck-forecast', FIGURE, 42),
  realT,
  (id) => id,
)!;
// The engine's MTTR/MTBF page prints no figures today (11 November key); six borrowed ones exercise the fold.
const mttr = {
  ...mttrMtbfModel(answerKey('a3-mttr-mtbf', 'a3-mttr-mtbf', 40), testT)!,
  figures: bottleneck.figures.slice(0, 6),
};
const pages = [
  {
    name: 'MTTR and MTBF',
    model: mttr,
    view: (m: PrintedPageModel) => h(MttrMtbfView, { model: m, nav: [], title: 'MTTR' }),
  },
  {
    name: 'Bottleneck',
    model: bottleneck,
    view: (m: PrintedPageModel) =>
      h(BottleneckView, { model: { ...bottleneck, ...m }, nav: [], title: 'Bottleneck' }),
  },
];

describe.each(pages)('$name: figures past four fold under the tiles', ({ model, view }) => {
  it('has more than four figures to fold', () => {
    expect(model.figures.length).toBeGreaterThan(4);
  });

  it('puts the Show detail with figures 5+ after the fourth tile and above the first chart or table', () => {
    const html = draw(view(model));
    const top = firstCard(html, model);
    const fold = html.indexOf('<details class="v2-show-detail">');
    expect(fold).toBeGreaterThan(at(html, model.figures[3]!.label));
    expect(fold).toBeLessThan(top);
    for (const figure of model.figures.slice(4)) {
      expect(at(html, figure.label)).toBeGreaterThan(fold);
      expect(at(html, figure.label)).toBeLessThan(top);
    }
  });

  it('draws no fold above the cards when there are four figures or fewer', () => {
    const four = { ...model, figures: model.figures.slice(0, 4) };
    const html = draw(view(four));
    expect(html.slice(0, firstCard(html, four))).not.toContain('v2-show-detail');
  });
});
