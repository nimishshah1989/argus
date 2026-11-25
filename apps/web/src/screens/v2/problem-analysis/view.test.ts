// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { problemAnalysisModel } from './adapter.js';
import type { ProblemAnalysisModel } from './model.js';
import { ProblemAnalysisView } from './View.js';

/** #752 review: the what-if fold is named by its own words and is absent when the engine sent no what-if. */
const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
const draw = (m: ProblemAnalysisModel) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(ProblemAnalysisView, { model: m, nav: [], title: 'Problem Analysis' }),
      ),
    ),
  );
const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('Problem Analysis view: the what-if fold (#752 review)', () => {
  it('folds the four what-if tiles under a Show detail named with the what-if words, said once', () => {
    const html = draw(model);
    const whatIf = esc(model.words.whatIf);
    expect(html).toContain(`<summary>${whatIf}</summary>`);
    expect(html.split(whatIf).length - 1).toBe(1);
    const fold = html.slice(html.indexOf(`<summary>${whatIf}</summary>`));
    for (const figure of model.whatIf) expect(fold).toContain(`aria-label="${esc(figure.label)}"`);
  });

  it('draws no what-if fold at all when the engine sent no what-if figures', () => {
    const html = draw({ ...model, whatIf: [] });
    expect(html).not.toContain(esc(model.words.whatIf));
  });

  it('closes the costliest-problems bars with one rest row for the groups past the 16 shown', () => {
    const html = draw(model);
    expect(testT('v2p.pa.rest')).toBe('All other groups');
    expect(html.split('data-rest').length - 1).toBe(1);
    expect(html).toContain('All other groups');
  });
});
