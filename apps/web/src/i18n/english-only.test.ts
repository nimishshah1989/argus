// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api.js', () => ({
  getToken: () => 'token',
  getConfig: () => Promise.resolve({ language: 'gu', i18nOverrides: {} }),
}));

const {
  default: i18n,
  GUJARATI_ON,
  applyConfigLanguage,
  setLanguage,
  shownLanguage,
} = await import('./index.js');

describe('English only for now (ADR 0036 R25)', () => {
  beforeEach(async () => {
    await setLanguage('gu');
  });

  it('Gujarati is off', () => {
    expect(GUJARATI_ON).toBe(false);
  });

  it('shows English whatever the phone or the company picked', () => {
    expect(shownLanguage('gu', 'gu')).toBe('en');
    expect(shownLanguage(null, undefined)).toBe('en');
  });

  it('a gu company in /config still shows English', async () => {
    applyConfigLanguage();
    await vi.waitFor(() => expect(i18n.language).toBe('en'), { timeout: 200 });
  });
});
