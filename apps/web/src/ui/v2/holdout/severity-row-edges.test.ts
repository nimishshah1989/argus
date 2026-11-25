// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { SeverityRow } from '../severity-row.js';

const items = (html: string) =>
  [...html.matchAll(/data-severity="(\w+)"><strong>(-?\d+)<\/strong>/g)].map((m) => [
    m[1],
    Number(m[2]),
  ]);

describe('SeverityRow: edges', () => {
  it('a zero is still shown as 0', () => {
    const html = renderToStaticMarkup(
      createElement(SeverityRow, { counts: { high: 0, medium: 0, low: 0, good: 0 } }),
    );
    expect(items(html)).toEqual([
      ['high', 0],
      ['medium', 0],
      ['low', 0],
      ['good', 0],
    ]);
  });
  it('the order is fixed, whatever the key order of counts', () => {
    const html = renderToStaticMarkup(
      createElement(SeverityRow, { counts: { good: 1, low: 2, medium: 3, high: 4 } }),
    );
    expect(items(html)).toEqual([
      ['high', 4],
      ['medium', 3],
      ['low', 2],
      ['good', 1],
    ]);
  });
});
