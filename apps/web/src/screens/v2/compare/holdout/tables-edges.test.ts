// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../../i18n/index.js';
import { tablesOf } from '../../printed-page/page-model.js';
import { figureOf, pageOf } from '../../printed-page/printed.js';
import { answerKey, realT } from '../../printed-page/test-support.js';
import { pageWords } from '../../printed-page/words.js';
import { compareFixture, DEFAULT_PAIR } from '../fixture.js';
import type { CompareModel } from '../model.js';
import { CompareView } from '../View.js';

/** Ticket 586, hidden: each table once, sortable, with the words handed over, and the source line still last. */

const nav = [
  { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
];
const words = pageWords(realT, 'v2p.all');
const page = pageOf(figureOf(answerKey('compare', 'compare', 43), 'compare'), realT)!;
const base = compareFixture(DEFAULT_PAIR)!;
const items = tablesOf(page.tables, words);
const model: CompareModel = { ...base, tables: { items, words: words.table } };
const render = (m: CompareModel) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/gallery'] },
      createElement(CompareView, { model: m, nav, title: 'Compare machines' }),
    ),
  );
const count = (text: string, part: string) => text.split(part).length - 1;

describe('Compare tables, hidden', () => {
  it('draws each table exactly once', () => {
    const markup = render(model);
    expect(count(markup, '>Health checkup<')).toBe(1);
    expect(count(markup, '>By shift<')).toBe(1);
  });

  it('every table can be sorted', () => {
    expect(count(render(model), 'class="v2-sort"')).toBeGreaterThanOrEqual(items.length);
  });

  it('uses the words it is handed, not its own', () => {
    const marked = { ...words.table, search: 'SEARCH-WORD-586' };
    const markup = render({ ...model, tables: { items, words: marked } });
    expect(count(markup, 'SEARCH-WORD-586')).toBeGreaterThanOrEqual(items.length);
    expect(count(render(model), 'SEARCH-WORD-586')).toBe(0);
  });

  it('keeps the source line after the tables', () => {
    const markup = render(model);
    expect(markup.lastIndexOf(base.source)).toBeGreaterThan(markup.lastIndexOf('By shift'));
  });

  it('an empty table list draws no table and leaves the rest of the page as it was', () => {
    expect(render({ ...model, tables: { items: [], words: words.table } })).toBe(render(base));
  });
});
