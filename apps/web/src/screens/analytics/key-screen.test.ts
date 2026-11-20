import { describe, expect, it } from 'vitest';
import { en, gu } from '@uptimo/shared/i18n';
import { figureHeading } from './key-screen.js';

const SCREEN = 'analytics.screen.shift-kpis';
const FIGURE = 'analytics.figure.shift-kpis.compare';
/** The engine's own title for the first shift figure (packages/domain standard-kpis.ts): English whatever the page language. */
const ENGINE = 'Shift-calendar KPIs';

describe('the heading of a figure under a screen', () => {
  it('replaces a title that only repeats the screen name, in English and in Gujarati', () => {
    expect(figureHeading(ENGINE, en[SCREEN], en[FIGURE])).toBe(en[FIGURE]);
    // The Gujarati page names the screen in Gujarati, but the engine's title is still English.
    expect(gu[SCREEN]).not.toBe(en[SCREEN]);
    expect(figureHeading(ENGINE, en[SCREEN], gu[FIGURE])).toBe(gu[FIGURE]);
  });

  it('keeps the engine title of any other figure, and names a blank one', () => {
    expect(figureHeading('The shift split', en[SCREEN], 'Label')).toBe('The shift split');
    expect(figureHeading('', en[SCREEN], 'Label')).toBe('Label');
  });
});
