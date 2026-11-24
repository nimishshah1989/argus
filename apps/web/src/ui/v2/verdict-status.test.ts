// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { FigureTile, type FigureData } from './figure-tile.js';
import { Verdict, type VerdictData } from './verdict.js';

const verdict = (status?: VerdictData['status']): VerdictData => ({
  context: '',
  headline: [{ text: 'Breakdowns are up 12%.' }],
  why: [],
  ...(status ? { status } : {}),
});
const figure: FigureData = { id: 'mttr', label: 'MTTR', value: '2.4 h', sub: '' };

describe('status on the verdict and the figure tile (ADR 0036 R7, #704)', () => {
  it('a verdict that is off target carries its status', () => {
    const html = renderToStaticMarkup(
      createElement(Verdict, { verdict: verdict('bad'), whyLabel: 'Why' }),
    );
    expect(html).toContain('data-status="bad"');
  });
  it('a figure tile carries the status its model passed', () => {
    const html = renderToStaticMarkup(
      createElement(FigureTile, { figure: { ...figure, status: 'watch' } }),
    );
    expect(html).toContain('data-status="watch"');
  });
});
