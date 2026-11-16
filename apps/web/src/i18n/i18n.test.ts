import { gu } from '@uptimo/shared/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import i18n, { pickLanguage, setLanguage } from './index.js';

describe('i18n catalogue', () => {
  afterEach(() => setLanguage('en'));

  it('falls back to English for an untranslated gu key', async () => {
    i18n.addResourceBundle('en', 'probe', { 'probe.title': 'Probe in English' });
    i18n.addResourceBundle('gu', 'probe', { 'probe.title': '' });
    await setLanguage('gu');
    expect(i18n.t('probe.title', { ns: 'probe' })).toBe('Probe in English');
  });

  it('shows Gujarati to a gu tenant for a translated key', async () => {
    await setLanguage('gu');
    const shown = i18n.t('floor.title');
    expect(shown).toBe(gu['floor.title']);
    expect(shown).not.toBe('Report a problem');
  });
});

describe('pickLanguage', () => {
  it('uses the company language until the person picks one on this phone', () => {
    expect(pickLanguage(null, 'gu')).toBe('gu');
    expect(pickLanguage(null, undefined)).toBe('en');
  });

  it('keeps the phone own choice over the company default', () => {
    expect(pickLanguage('en', 'gu')).toBe('en');
    expect(pickLanguage('gu', 'en')).toBe('gu');
  });

  it('falls back to the company default for a language it does not know', () => {
    expect(pickLanguage('fr', 'gu')).toBe('gu');
    expect(pickLanguage('fr', 'en')).toBe('en');
    expect(pickLanguage('fr', undefined)).toBe('en');
  });
});
