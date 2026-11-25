// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReasonChips, type Reason } from '../reason-chip.js';

const html = (reasons: Reason[]) => renderToStaticMarkup(createElement(ReasonChips, { reasons }));
const chips = (reasons: Reason[]) =>
  [...html(reasons).matchAll(/<span class="v2-reason">([^<]*)<\/span>/g)].map((m) => m[1]);

describe('ReasonChips: edges', () => {
  it('a count of 1 or none prints no ×', () => {
    expect(chips([{ text: 'Repeat', n: 1 }, { text: 'Idle' }])).toEqual(['Repeat', 'Idle']);
  });
  it('an empty list renders nothing', () => {
    expect(ReasonChips({ reasons: [] })).toBeNull();
    expect(html([])).toBe('');
  });
});
