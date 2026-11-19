// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CellPanel, type CellItem } from './cell-panel.js';
import { Sparkline } from './sparkline.js';
import { Tag, TagGlyph, Tags, tagHtml } from './tags.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);

describe('tags', () => {
  it('print the word, the hidden extra for a screen reader, and an icon', () => {
    const out = html(
      createElement(Tag, { tag: { tone: 'good', word: 'Improving', more: 'of May' } }),
    );
    expect(out).toContain('Improving');
    expect(out).toContain('of May');
    expect(out).toContain('<svg');
  });

  it('draw nothing for an empty list', () => {
    expect(html(createElement(Tags, { list: [] }))).toBe('');
  });

  it('leave the word for a screen reader when only the icon shows', () => {
    const out = html(createElement(TagGlyph, { tag: { tone: 'bad', word: 'Repeat offender' } }));
    expect(out).toContain('Repeat offender');
    expect(out).toContain('sr-only');
  });

  it('make tooltip markup that says the same words and cannot carry markup of its own', () => {
    const out = tagHtml({ tone: 'watch', word: '<b>Spike</b>', more: 'of "May"' });
    expect(out).toContain('&#60;b&#62;Spike&#60;/b&#62;');
    expect(out).toContain('&#34;May&#34;');
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

  it('prints a dash and the no-records words, never 0, for a cell with no value', () => {
    expect(out).toContain('—');
    expect(out).toContain('No records yet');
    expect(out).not.toMatch(/>0</);
  });
});
