// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { periodFrom, PeriodToggle } from './period-toggle.js';

/** aria-pressed of each choice, in the order rendered. */
const pressed = (html: string) =>
  [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1]);

describe('PeriodToggle (ADR 0036 R4)', () => {
  it('reads ?period=full as the full year, anything else as days so far', () => {
    expect(periodFrom('?period=full')).toBe('full');
    expect(periodFrom('?period=sofar')).toBe('sofar');
  });

  it('offers two choices and presses the current one', () => {
    const onChange = () => undefined;
    const sofar = renderToStaticMarkup(createElement(PeriodToggle, { value: 'sofar', onChange }));
    const full = renderToStaticMarkup(createElement(PeriodToggle, { value: 'full', onChange }));
    expect(pressed(sofar)).toEqual(['true', 'false']);
    expect(pressed(full)).toEqual(['false', 'true']);
  });
});
