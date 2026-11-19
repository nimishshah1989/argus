import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../../i18n/index.js';
import { Template, type TemplateProps } from './template.js';

const FULL = {
  trail: 'TRAIL',
  title: 'TITLE',
  lede: 'LEDE',
  actions: 'ACTIONS',
  filters: 'FILTERS',
  figures: 'FIGURES',
  main: 'MAIN',
  drill: 'DRILL',
  drillTitle: 'DRILLTITLE',
} as const;

const html = (p: TemplateProps) => renderToStaticMarkup(h(Template, p));
const at = (page: string, word: string) => page.indexOf(word);

describe('a template on a phone', () => {
  it.each(['overview', 'analysis', 'register', 'entity', 'queue'] as const)(
    'puts the %s regions in one fixed reading order',
    (kind) => {
      const page = html({
        kind,
        ...FULL,
        aside: kind === 'analysis' || kind === 'entity' ? 'ASIDE' : undefined,
      } as TemplateProps);
      const order = ['TRAIL', 'TITLE', 'LEDE', 'ACTIONS', 'FILTERS', 'FIGURES', 'MAIN'];
      if (kind === 'analysis' || kind === 'entity') order.push('ASIDE');
      order.push('DRILLTITLE', 'DRILL</section>');
      const spots = order.map((word) => at(page, word));
      expect(spots.every((spot) => spot >= 0)).toBe(true);
      expect([...spots].sort((a, b) => a - b)).toEqual(spots);
    },
  );

  it('names the page by its title and the drill area by its own title', () => {
    const page = html({ kind: 'register', ...FULL });
    expect(page).toMatch(/<h2[^>]*>TITLE<\/h2>/);
    expect(page).toMatch(
      /<section[^>]*aria-labelledby="([^"]+)"[^>]*><h3 id="\1">DRILLTITLE<\/h3>/,
    );
  });

  it('leaves out a region the screen does not give, with no empty frame in its place', () => {
    const page = html({ kind: 'overview', title: 'TITLE', main: 'MAIN' });
    for (const cls of [
      'at-trail',
      'at-filters',
      'at-figures',
      'at-aside',
      'at-drill',
      'at-actions',
    ])
      expect(page).not.toContain(cls);
    expect(page).toContain('MAIN');
  });
});

describe('which region sits beside the content on a wide screen', () => {
  const side = (p: TemplateProps) => html(p).match(/data-side="([^"]*)"/)?.[1];

  it('is the drill on a register and a work queue, only when there is one', () => {
    expect(side({ kind: 'register', ...FULL })).toBe('drill');
    expect(side({ kind: 'queue', ...FULL })).toBe('drill');
    expect(side({ kind: 'register', title: 'T', main: 'M' })).toBeUndefined();
  });

  it('is the aside on an analysis and an entity, with the drill left full width below', () => {
    expect(side({ kind: 'analysis', ...FULL, aside: 'ASIDE' })).toBe('aside');
    expect(side({ kind: 'entity', ...FULL, aside: 'ASIDE' })).toBe('aside');
    expect(side({ kind: 'analysis', ...FULL })).toBeUndefined();
  });

  it('is nothing on an overview', () => {
    expect(side({ kind: 'overview', ...FULL })).toBeUndefined();
  });
});

describe('a template that has no data to show', () => {
  const base = { kind: 'analysis', ...FULL, aside: 'ASIDE' } as const;

  it('keeps the title and the filters and drops the figures, content and drill', () => {
    for (const state of ['loading', 'empty', 'error', 'offline'] as const) {
      const page = html({ ...base, state, empty: 'NOTHING', onRetry: () => {} });
      expect(page).toContain('TITLE');
      expect(page).toContain('FILTERS');
      for (const word of ['FIGURES', 'MAIN', 'ASIDE', 'DRILL']) expect(page).not.toContain(word);
    }
  });

  it("says what happened: loading is announced, empty uses the screen's words, an error offers Retry", () => {
    expect(html({ ...base, state: 'loading' })).toContain('role="status"');
    expect(html({ ...base, state: 'empty', empty: 'NOTHING' })).toContain('NOTHING');
    const error = html({ ...base, state: 'error' });
    expect(error).toContain('role="alert"');
    expect(error).toMatch(/<button[^>]*>[^<]+<\/button>/);
  });

  it('shows everything again when the state is ready', () => {
    const page = html({ ...base, state: 'ready' });
    for (const word of ['FIGURES', 'MAIN', 'ASIDE', 'DRILL']) expect(page).toContain(word);
  });
});
