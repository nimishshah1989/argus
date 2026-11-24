// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { FigureTile } from '../figure-tile.js';
import { Verdict, type VerdictData } from '../verdict.js';

const verdict = (status?: VerdictData['status']): VerdictData => ({
  context: '',
  headline: [{ text: 'Steady.' }],
  why: [],
  ...(status ? { status } : {}),
});
const draw = (v: VerdictData) =>
  renderToStaticMarkup(createElement(Verdict, { verdict: v, whyLabel: 'Why' }));

describe('verdict status: edges', () => {
  it('neutral or absent draws no status', () => {
    expect(draw(verdict('neutral'))).not.toContain('data-status');
    expect(draw(verdict())).not.toContain('data-status');
  });
  it('good draws good', () => {
    expect(draw(verdict('good'))).toContain('data-status="good"');
  });
  it('a figure tile without status has no attribute', () => {
    const html = renderToStaticMarkup(
      createElement(FigureTile, { figure: { id: 'a', label: 'A', value: '1', sub: '' } }),
    );
    expect(html).not.toContain('data-status');
  });
});
