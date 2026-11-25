// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickLanguage, shownLanguage } from '../index.js';

describe('English only: edges', () => {
  it('a saved "gu" on the phone shows English', () => {
    expect(shownLanguage('gu', 'en')).toBe('en');
    expect(shownLanguage('gu', undefined)).toBe('en');
  });
  it('a "gu" company shows English', () => {
    expect(shownLanguage(null, 'gu')).toBe('en');
  });
  it('an unknown value shows English', () => {
    expect(shownLanguage('fr', 'xx')).toBe('en');
    expect(shownLanguage('', '')).toBe('en');
  });
  it('pickLanguage still picks Gujarati for when it is turned on', () => {
    expect(pickLanguage('gu', 'en')).toBe('gu');
  });
});
