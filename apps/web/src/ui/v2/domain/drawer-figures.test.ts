// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { CellDetail, type CellDetailData } from './cell-detail.js';
import { DETAIL_MAX_FIGURES, DetailFigures, FullPageLink } from './detail-parts.js';
import { PersonDetail, type PersonDetailData } from './person-detail.js';

const count = (html: string, part: string) => html.split(part).length - 1;
const FULL = { href: '/cells/7', label: 'Open the full page' };

const cell: CellDetailData = {
  name: 'Cell 7',
  machineCount: '33 machines',
  mix: [{ state: 'down', text: '2 down' }],
  hours: { shown: '776.8 h', value: 776.8 },
  worst: [],
};
const person: PersonDetailData = {
  name: 'A. Person',
  role: 'Fitter',
  now: [],
  jobs: '12',
  hours: '40 h',
};
const CELL_WORDS = { now: 'Now', figures: 'Figures', hours: 'Hours', worst: 'Worst' };
const PERSON_WORDS = {
  now: 'Now',
  free: 'Free',
  month: 'This month',
  jobs: 'Jobs',
  hours: 'Hours',
};

describe('entity drawers: at most 3 figures and a link to the full page (ADR 0036 R24, ADR 0041)', () => {
  it('the cap is 3', () => {
    expect(DETAIL_MAX_FIGURES).toBe(3);
  });

  it('given 5 figures, shows the first 3 in the order given', () => {
    const figures = ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({
      label: `Fig ${l}`,
      value: String(i + 1),
    }));
    const html = renderToStaticMarkup(h(DetailFigures, { figures }));
    expect(html).toContain('v2-figures');
    expect(count(html, 'v2-kpi-value')).toBe(3);
    expect(html.indexOf('Fig A')).toBeLessThan(html.indexOf('Fig B'));
    expect(html.indexOf('Fig B')).toBeLessThan(html.indexOf('Fig C'));
    expect(html).not.toContain('Fig D');
  });

  it('the full-page link is one link to the route, in the link style', () => {
    const html = renderToStaticMarkup(h(FullPageLink, FULL));
    expect(count(html, '<a')).toBe(1);
    expect(html).toContain('href="/cells/7"');
    expect(html).toContain('data-full-page');
    expect(html).toContain('v2-link');
    expect(html).toContain('Open the full page');
  });

  it('a cell drawer handed its full page draws exactly one link to it', () => {
    const html = renderToStaticMarkup(
      h(CellDetail, { c: cell, words: CELL_WORDS, source: 'src', full: FULL }),
    );
    expect(count(html, 'data-full-page')).toBe(1);
    expect(html).toContain('href="/cells/7"');
  });

  it('a person drawer handed its full page draws exactly one link to it', () => {
    const full = { href: '/people/a', label: 'Open the full page' };
    const html = renderToStaticMarkup(
      h(PersonDetail, { p: person, words: PERSON_WORDS, source: 'src', full }),
    );
    expect(count(html, 'data-full-page')).toBe(1);
    expect(html).toContain('href="/people/a"');
  });
});
