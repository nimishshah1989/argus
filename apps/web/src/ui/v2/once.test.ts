// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FigureTile } from './figure-tile.js';
import { Verdict } from './verdict.js';

/** ADR 0033: the kit never prints one sentence twice. */
describe('no sentence twice (ticket 642)', () => {
  const figure = { id: 'x', label: 'Hours', value: '120', sub: 'non-PM breakdowns' };
  const count = (html: string, text: string) => html.split(text).length - 1;

  it('a figure tile whose yardstick is its own line prints that line once, as the yardstick', () => {
    const out = renderToStaticMarkup(
      createElement(FigureTile, { figure: { ...figure, yardstick: 'non-PM breakdowns' } }),
    );
    expect(count(out, 'non-PM breakdowns')).toBe(1);
    expect(out).toContain('class="v2-yardstick"');
  });

  it('a figure tile with a different yardstick still prints both lines', () => {
    const out = renderToStaticMarkup(
      createElement(FigureTile, { figure: { ...figure, yardstick: 'Last month 98' } }),
    );
    expect(count(out, 'non-PM breakdowns')).toBe(1);
    expect(count(out, 'Last month 98')).toBe(1);
  });

  it('a verdict with no Why lines draws no Why button', () => {
    const verdict = { context: 'Source', headline: [{ text: 'Headline' }], why: [] };
    const out = renderToStaticMarkup(createElement(Verdict, { verdict, whyLabel: 'Why?' }));
    expect(out).toContain('Headline');
    expect(out).not.toContain('Why?');
  });

  it('a verdict with Why lines keeps its Why button', () => {
    const verdict = {
      context: 'Source',
      headline: [{ text: 'Headline' }],
      why: [[{ text: 'Because' }]],
    };
    const out = renderToStaticMarkup(createElement(Verdict, { verdict, whyLabel: 'Why?' }));
    expect(out).toContain('Why?');
  });
});
