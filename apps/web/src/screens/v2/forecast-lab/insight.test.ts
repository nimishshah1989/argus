// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { forecastLabModel, FIGURE } from './adapter.js';
import type { ForecastLabModel } from './model.js';
import { ForecastLabView } from './View.js';

/**
 * ADR 0035 (ticket 662): the method table and the month detail each open with a takeaway; the page has no figure
 * tiles. Critical tests only (ADR 0034): the figures in each line, measured on the frozen answer key, never wording.
 */
const model: ForecastLabModel = forecastLabModel(answerKey('forecast-lab', FIGURE, 42), realT)!;
const SECTIONS = ['methods', 'months'];

describe('Forecast Lab insight (ticket 662)', () => {
  it('opens both tables with a takeaway; the page has no figure tile to measure', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
    expect(model.figures).toEqual([]);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('names the month whose actual hours stand out, by its printed figure', () => {
    for (const figure of ['Jun 26', '2.5', '660.4'])
      expect(model.takeaways?.months?.text ?? '').toContain(figure);
  });

  it('names no method: their accuracy scores are all 1.84 to 1.85', () => {
    expect(model.takeaways?.methods?.text.length).toBeGreaterThan(0);
    expect(model.takeaways?.methods?.outlier).toBeUndefined();
  });

  it('draws both takeaways on the page', () => {
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(ForecastLabView, { model, nav: [], title: 'Forecast Lab' })),
      ),
    );
    for (const id of SECTIONS)
      expect(html.includes(model.takeaways?.[id]?.text ?? '∅'), `${id} drawn`).toBe(true);
  });
});
