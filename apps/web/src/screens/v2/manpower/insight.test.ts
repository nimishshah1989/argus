// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { manpowerModel } from './adapter.js';
import { ManpowerView } from './View.js';

/**
 * ADR 0035 (ticket 669): each table opens with one takeaway over all its rows (never the page shown, never the
 * PLANT TOTAL row), and each of the three figures names its yardstick. Frozen 11 Nov answer key. Critical tests only
 * (ADR 0034): the figures in each line, not its wording or tone.
 */
const SECTIONS = [
  'people',
  'pm-jobs',
  'pm-hours',
  'specialization',
  'monthly-count',
  'monthly-hours',
];
const model = manpowerModel(answerKey('a4-manpower', 'a4-manpower', 41), testT)!;
const text = (id: string) => model.takeaways?.[id]?.text ?? '';
const hasFigures = (id: string, figures: string[]) => {
  for (const figure of figures) expect(text(id), id).toContain(figure);
};

describe('Manpower takeaways and yardsticks (ticket 669)', () => {
  it('gives every table one takeaway and every figure a yardstick', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(text(id).length, id).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('says how few people carry half the breakdown hours and the PM work, without the plant total row', () => {
    hasFigures('people', ['3', '14', '51%']);
    hasFigures('pm-jobs', ['3', '14', '58%']);
    hasFigures('pm-hours', ['4', '14', '61%']);
  });

  it('says how few categories take most of the breakdowns the team handled', () => {
    hasFigures('specialization', ['2', '14', '70%']);
  });

  it('names the month that stands out, summed over everyone', () => {
    hasFigures('monthly-count', ['Oct', '3.2', '252']);
    hasFigures('monthly-hours', ['Jun', '3.4', '660.5']);
  });

  it('measures each figure: breakdowns a member, hours a breakdown, and the team share of members', () => {
    const yardstick = (id: string) => model.figures.find((f) => f.id === id)?.yardstick ?? '';
    expect(yardstick('kpi-0')).toContain('91.4');
    expect(yardstick('kpi-1')).toContain('2.39');
    expect(yardstick('kpi-2')).toContain('93%');
    expect(yardstick('kpi-2')).toContain('14');
  });

  it('draws each line on the page', () => {
    const nav = [{ id: 'm', label: 'M', icon: 'machines' as const, href: '/a', current: true }];
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(ManpowerView, { model, nav, title: 'Title' })),
    );
    for (const id of SECTIONS) {
      expect(text(id), id).not.toBe('');
      expect(markup).toContain(text(id));
    }
  });
});
