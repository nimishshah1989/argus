// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, keyPage, realT } from '../printed-page/test-support.js';
import { bottleneckModel, FIGURE } from './adapter.js';
import type { BottleneckModel } from './model.js';
import { BottleneckView } from './View.js';

/**
 * ADR 0035 (ticket 661): each of the engine's nine tables opens with a takeaway, and each of its fourteen figures names
 * a yardstick (the engine's own basis line, ticket 642's precedent). Critical tests only (ADR 0034): the figures in each
 * line, measured on the frozen answer key, never wording.
 */
const reply = answerKey('a9-bottleneck-forecast', FIGURE, 42);
const model: BottleneckModel = bottleneckModel(reply, realT, (id) => id)!;
const SECTIONS = [
  'risk',
  'down-log',
  'down-backup',
  'category',
  'cell',
  'forecast',
  'trend-category',
  'trend-machine',
  'repeats',
];
const has = (id: string, figures: string[]) => {
  for (const figure of figures) expect(model.takeaways?.[id]?.text ?? '', id).toContain(figure);
};

describe('Bottleneck insight (ticket 661)', () => {
  it('opens every table with a takeaway and names a yardstick on every figure', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('measures each figure against the engine’s own basis for it, inventing none', () => {
    expect(model.figures.map((figure) => figure.yardstick)).toEqual(
      keyPage(reply).kpis.map((kpi) => kpi.sub),
    );
  });

  it('names the machine, problem or kind that stands out in each table, by its printed figure', () => {
    has('risk', ['WJ-01', '1.6', '87']);
    has('down-log', ['KMT pump water leakage', '1.8', '15.0']);
    has('forecast', ['WJ-01', '1.8', '6.1']);
    has('trend-category', ['Vertical Machining Center', '3.0', '6.24']);
    has('trend-machine', ['VC-16', '2.0', '4.31']);
  });

  it('says how few rows hold most of the breakdown hours, over every row of the table', () => {
    has('category', ['2', '14', '65%']);
    has('cell', ['3', '9', '65%']);
    has('repeats', ['5', '26', '51%']);
  });

  it('names nothing in the backup table, which has no number to compare', () => {
    expect(model.takeaways?.['down-backup']?.outlier).toBeUndefined();
  });

  it('draws every takeaway on the page', () => {
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(BottleneckView, { model, nav: [], title: 'Bottleneck' })),
      ),
    );
    for (const id of SECTIONS)
      expect(html.includes(model.takeaways?.[id]?.text ?? '∅'), `${id} drawn`).toBe(true);
  });
});
