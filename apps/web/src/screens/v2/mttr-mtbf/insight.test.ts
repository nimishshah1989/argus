// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { mttrMtbfModel } from './adapter.js';
import type { MttrMtbfModel } from './model.js';
import { MttrMtbfView } from './View.js';

/**
 * ADR 0035 (ticket 667): each of the eight tables opens with one takeaway over all its rows, never the page shown.
 * Frozen 11 Nov answer key. Critical tests only (ADR 0034): the figures in each line, not its wording or tone.
 */
const SECTIONS = [
  'categories',
  'cells',
  'cell-mttr',
  'cell-mtbf',
  'age-mttr',
  'age-mtbf',
  'age-bands',
  'machines',
];
const model: MttrMtbfModel = mttrMtbfModel(answerKey('a3-mttr-mtbf', 'a3-mttr-mtbf', 40), testT)!;
const text = (id: string) => model.takeaways?.[id]?.text ?? '';
const hasFigures = (id: string, figures: string[]) => {
  for (const figure of figures) expect(text(id), id).toContain(figure);
};

describe('MTTR and MTBF takeaways (ticket 667)', () => {
  it('gives every table one takeaway; the page has no figure tiles to measure', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(text(id).length, id).toBeGreaterThan(0);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('names the slowest category to fix and the cell that runs least between breakdowns', () => {
    hasFigures('categories', ['Turnmill', '3.1', '5.94']);
    hasFigures('cells', ['Cell 3', '1.8', '270.11']);
  });

  it('names the plant month that stands out, from the plant-wide row only', () => {
    hasFigures('cell-mttr', ['Jun', '3.3', '7.50']);
    hasFigures('cell-mtbf', ['Oct', '1.9', '311.5']);
  });

  it('reads the age bands by their year totals, and says nothing when no band stands out', () => {
    hasFigures('age-mtbf', ['20+ yrs', '2.6', '162.5']);
    expect(text('age-mttr')).not.toMatch(/\d/);
    expect(text('age-bands')).not.toMatch(/\d/);
  });

  it('reads all 125 machines, not the ten a page shows', () => {
    hasFigures('machines', ['TMC-2', '8.1', '15.38']);
  });

  it('draws each line on the page', () => {
    const nav = [{ id: 'm', label: 'M', icon: 'machines' as const, href: '/a', current: true }];
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(MttrMtbfView, { model, nav, title: 'Title' })),
    );
    for (const id of SECTIONS) {
      expect(text(id), id).not.toBe('');
      expect(markup).toContain(text(id));
    }
  });
});
