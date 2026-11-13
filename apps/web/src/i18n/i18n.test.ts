import { describe, expect, it } from 'vitest';
import i18n, { setLanguage } from './index.js';

describe('i18n catalogue', () => {
  it('falls back to English for an untranslated gu key', async () => {
    await setLanguage('gu');
    expect(i18n.t('floor.title')).toBe('Report a problem');
    await setLanguage('en');
    expect(i18n.t('floor.title')).toBe('Report a problem');
  });
});
