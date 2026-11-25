// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { SeverityRow } from './severity-row.js';

/** Each item's severity key and its count, in the order rendered. */
const items = (html: string) =>
  [...html.matchAll(/data-severity="(\w+)"><strong>(-?\d+)<\/strong>/g)].map((m) => [
    m[1],
    Number(m[2]),
  ]);

describe('SeverityRow (ADR 0036 R3)', () => {
  it('shows four counts: high, medium, low, good', () => {
    const html = renderToStaticMarkup(
      createElement(SeverityRow, { counts: { high: 3, medium: 5, low: 2, good: 4 } }),
    );
    expect(items(html)).toEqual([
      ['high', 3],
      ['medium', 5],
      ['low', 2],
      ['good', 4],
    ]);
  });
});
