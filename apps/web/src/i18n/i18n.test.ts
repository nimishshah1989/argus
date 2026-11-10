import { describe, expect, it } from 'vitest';
import i18n, { setLanguage } from './index.js';
import { en } from './en.js';
import { gu } from './gu.js';

describe('i18n catalogue', () => {
  it('keeps the en and gu key sets identical', () => {
    expect(Object.keys(gu).sort()).toEqual(Object.keys(en).sort());
  });

  it('falls back to English for an untranslated gu key', async () => {
    await setLanguage('gu');
    expect(i18n.t('floor.title')).toBe('Report a problem');
    await setLanguage('en');
    expect(i18n.t('floor.title')).toBe('Report a problem');
  });
});
