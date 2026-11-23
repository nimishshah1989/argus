// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { tablesOf } from '../printed-page/page-model.js';
import { figureOf, pageOf } from '../printed-page/printed.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { pageWords } from '../printed-page/words.js';
import { compareFixture, DEFAULT_PAIR } from './fixture.js';
import type { CompareModel } from './model.js';
import { CompareView } from './View.js';

/**
 * Ticket 586 (ADR 0020 §3): Compare draws v1's six tables, whole, under the weekly chart — the engine's frozen page for
 * VC-28 and VC-22 through the shared `tablesOf`, as the live adapter will hand them over.
 */

const nav = [
  { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
];
const words = pageWords(realT, 'v2p.all');
const page = pageOf(figureOf(answerKey('compare', 'compare', 43), 'compare'), realT)!;
const withTables: CompareModel = {
  ...compareFixture(DEFAULT_PAIR)!,
  tables: { items: tablesOf(page.tables, words), words: words.table },
};

const render = (model: CompareModel) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/gallery'] },
      createElement(CompareView, { model, nav, title: 'Compare machines' }),
    ),
  );

const TITLES = [
  'Health scorecard (0–10, adjusted for age)',
  'Health checkup',
  'Specifications',
  'VC-28 — longest breakdowns',
  'VC-22 — longest breakdowns',
  'By shift',
];

describe('Compare draws the engine’s six tables', () => {
  it('prints every table, in the engine’s order, after the weekly chart', () => {
    const markup = render(withTables);
    const trend = markup.indexOf('Breakdown hours a week');
    expect(trend).toBeGreaterThan(-1);
    let last = trend;
    for (const title of TITLES) {
      const at = markup.indexOf(title, last);
      expect(at, title).toBeGreaterThan(last);
      last = at;
    }
  });

  it('prints the health score, its category average column, and v1’s ✓ on the better value', () => {
    const markup = render(withTables);
    expect(markup).toContain('Category average');
    expect(markup).toContain('Health score (0–10, age-adjusted)');
    expect(markup).toContain('2.7 ✓');
  });

  it('a model with no tables draws none of them', () => {
    const markup = render(compareFixture(DEFAULT_PAIR)!);
    for (const title of TITLES) expect(markup).not.toContain(title);
  });
});
