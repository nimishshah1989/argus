// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { categoryCellModel } from './adapter.js';
import type { CategoryCellModel } from './model.js';
import { CategoryCellView } from './View.js';

/**
 * ADR 0035 (ticket 665): each table opens with one takeaway over the BD hours of all its rows, never the page shown.
 * Frozen 11 Nov answer key. Critical tests only (ADR 0034): the figures in each line, not its wording or tone.
 */
const SECTIONS = ['categories', 'cells', 'machines'];
const model: CategoryCellModel = categoryCellModel(
  answerKey('a2-category-cell', 'a2-category-cell', 40),
  testT,
)!;
const text = (id: string) => model.takeaways?.[id]?.text ?? '';
const hasFigures = (id: string, figures: string[]) => {
  for (const figure of figures) expect(text(id), id).toContain(figure);
};

describe('Category and cell takeaways (ticket 665)', () => {
  it('gives every table one takeaway; the page has no figure tiles to measure', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(text(id).length, id).toBeGreaterThan(0);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('says how few categories and cells hold most of the breakdown hours', () => {
    hasFigures('categories', ['2', '14', '65%']);
    hasFigures('cells', ['3', '9', '61%']);
  });

  it('reads all 125 machines of the merged table, not the ten a page shows', () => {
    hasFigures('machines', ['13', '125', '51%']);
  });

  it('draws each line on the page', () => {
    const nav = [{ id: 'm', label: 'M', icon: 'machines' as const, href: '/a', current: true }];
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {},
        createElement(CategoryCellView, { model, nav, title: 'Title' }),
      ),
    );
    for (const id of SECTIONS) {
      expect(text(id), id).not.toBe('');
      expect(markup).toContain(text(id));
    }
  });
});
