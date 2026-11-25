// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api.js', () => ({
  getToken: () => 'token',
  getConfig: () => Promise.resolve({ language: 'gu', i18nOverrides: {} }),
}));

/** Gujarati behind its switch (ADR 0038): `uptimo.gujarati` = `on` on this phone, read once at load. */
async function loadWith(value: string | null) {
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'uptimo.gujarati' ? value : null),
    setItem: () => undefined,
  });
  return import('./index.js');
}

describe('Gujarati behind its switch', () => {
  it('switched on, the phone and the company pick the language again', async () => {
    const { GUJARATI_ON, shownLanguage } = await loadWith('on');
    expect(GUJARATI_ON).toBe(true);
    expect(shownLanguage(null, 'gu')).toBe('gu');
    expect(shownLanguage('en', 'gu')).toBe('en');
  });

  it('any other value leaves it off', async () => {
    const { GUJARATI_ON, shownLanguage } = await loadWith('yes');
    expect(GUJARATI_ON).toBe(false);
    expect(shownLanguage('gu', 'gu')).toBe('en');
  });
});
