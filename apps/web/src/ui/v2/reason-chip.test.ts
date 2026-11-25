// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReasonChips, type Reason } from './reason-chip.js';

const chips = (reasons: Reason[]) =>
  [
    ...renderToStaticMarkup(createElement(ReasonChips, { reasons })).matchAll(
      /<span class="v2-reason">([^<]*)<\/span>/g,
    ),
  ].map((m) => m[1]);

describe('ReasonChips (ADR 0036 R17)', () => {
  it('prints one chip per reason, in order, with the count when above 1', () => {
    expect(chips([{ text: 'Repeat', n: 3 }, { text: 'Late start' }])).toEqual([
      'Repeat ×3',
      'Late start',
    ]);
  });
});
