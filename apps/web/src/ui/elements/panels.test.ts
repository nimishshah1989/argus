// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CellPanel, type CellItem } from './cell-panel.js';
import { Sparkline } from './sparkline.js';
import { tagHtml } from './tag-html.js';
import { Tag, TagGlyph, Tags } from './tags.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);

/** What a sighted person reads: the markup without the text that is only for a screen reader. */
const visible = (markup: string) =>
  markup
    .replace(/<span class="sr-only">.*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
/** What a screen reader reads: all the text. */
const spoken = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('tags', () => {
  it('print the word, say the hidden extra only to a screen reader, and hide the icon from one', () => {
    const out = html(
      createElement(Tag, { tag: { tone: 'good', word: 'Improving', more: 'of May' } }),
    );
    expect(visible(out)).toBe('Improving');
    expect(spoken(out)).toBe('Improving of May');
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('draw nothing for an empty list', () => {
    expect(html(createElement(Tags, { list: [] }))).toBe('');
  });

  it('leave the word for a screen reader only when just the icon shows', () => {
    const out = html(createElement(TagGlyph, { tag: { tone: 'bad', word: 'Repeat offender' } }));
    expect(visible(out)).toBe('');
    expect(spoken(out)).toBe('Repeat offender');
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('wear the same icon in a tooltip as on the page', () => {
    const tag = { tone: 'bad' as const, word: 'Worse' };
    const icon = (markup: string) => markup.match(/<svg[\s\S]*?<\/svg>/)?.[0];
    expect(icon(tagHtml(tag))).toBe(icon(html(createElement(Tag, { tag }))));
  });

  it('make tooltip markup that reads as the same words and cannot carry markup of its own', () => {
    const out = tagHtml({ tone: 'watch', word: '<b>Spike</b>', more: 'of "May"' });
    const decoded = spoken(out)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    expect(decoded).toBe('<b>Spike</b> of "May"');
    expect(out).not.toContain('<b>');
  });
});

describe('sparkline with a reference, a gap and a running month', () => {
  const draw = (over: object = {}) =>
    html(
      createElement(Sparkline, {
        values: [1, null, 3, 4],
        reference: [2, 2, 2, 2],
        label: 'By month',
        ...over,
      }),
    );

  it('is a labelled image', () => {
    expect(draw()).toContain('aria-label="By month"');
  });

  it('breaks the line at a missing month instead of bridging it', () => {
    const lines = [...draw().matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!);
    expect(lines.some((d) => (d.match(/M/g)?.length ?? 0) >= 2)).toBe(true);
  });

  it('draws nothing when fewer than two months have a value', () => {
    expect(draw({ values: [null, 5, null, null] })).toBe('');
  });
});

describe('cell panel', () => {
  const cells: CellItem[] = [
    {
      id: 'a',
      name: 'Cell A',
      value: '1.25',
      unit: '%',
      tone: 'good',
      tag: { tone: 'good', word: 'Lower than plant' },
      series: [1, 2, 3],
      seriesLabel: 'Cell A by month',
    },
    {
      id: 'b',
      name: 'Cell B',
      value: null,
      tone: 'neutral',
      series: [null, null, null],
      seriesLabel: 'Cell B',
    },
  ];
  const out = html(
    createElement(CellPanel, {
      title: 'Every cell',
      summary: '1 of 2 did better',
      cells,
      reference: [2, 2, 2],
      empty: 'No records yet',
    }),
  );

  it('shows each cell with its figure and the word for how it did', () => {
    for (const text of ['Every cell', '1 of 2 did better', 'Cell A', '1.25', 'Lower than plant'])
      expect(out).toContain(text);
  });

  it('draws a colour only where its word is, and takes it from the tag', () => {
    const odd: CellItem[] = [
      {
        id: 'x',
        name: 'X',
        value: '2',
        tone: 'good',
        tag: { tone: 'bad', word: 'Higher' },
        series: [1, 2],
        seriesLabel: 'x',
      },
      {
        id: 'y',
        name: 'Y',
        value: null,
        tone: 'bad',
        tag: { tone: 'bad', word: 'Higher' },
        series: [null, null],
        seriesLabel: 'y',
      },
    ];
    const o = html(createElement(CellPanel, { title: 't', cells: odd, empty: 'None' }));
    expect(o.match(/data-tone="bad"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(o).not.toContain('data-tone="good"');
    const withNull = o.slice(o.indexOf('>Y<'));
    expect(withNull).not.toContain('Higher');
    expect(withNull).not.toContain('data-tone="bad"');
  });

  it('puts its title at the heading level it is told', () => {
    const o = html(
      createElement(CellPanel, { title: 'Cells', cells, empty: 'None', headingLevel: 2 }),
    );
    expect(o).toMatch(/<h2[^>]*>Cells<\/h2>/);
  });

  it('prints a dash and the no-records words, never 0, for a cell with no value', () => {
    expect(out).toContain('—');
    expect(out).toContain('No records yet');
    expect(out).not.toMatch(/>0</);
  });
});
