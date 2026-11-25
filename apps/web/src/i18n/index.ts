import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getConfig, getToken } from '../api.js';
import { en, gu, overlaidGu, type UiOverrides } from '@uptimo/shared/i18n';

export const SUPPORTED_LANGUAGES = ['en', 'gu'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  // Copies: i18next keeps the resource objects it is handed, and the override merge below must not edit the
  // compiled catalogue (another caller reads it as the fallback).
  resources: { en: { translation: { ...en } }, gu: { translation: { ...gu } } },
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

/** Switch the active language; empty `gu` values fall back to English. */
export function setLanguage(lng: Language): Promise<void> {
  return i18n.changeLanguage(lng).then(() => {
    // Screen readers and the browser's Gujarati shaping read the page language from <html lang>.
    if (typeof document !== 'undefined') document.documentElement.lang = lng;
  });
}

const LANGUAGE_KEY = 'uptimo.language';

/** A language the person picked on this phone wins over the company's default; an unknown value falls back to it. */
export function pickLanguage(saved: string | null, company: string | undefined): Language {
  const known = (value: string | null | undefined): Language | undefined =>
    SUPPORTED_LANGUAGES.find((lng) => lng === value);
  return known(saved) ?? known(company) ?? 'en';
}

/**
 * Gujarati is off until Nimish turns it on (ADR 0036 R25, switch ADR 0038): `uptimo.gujarati` = `on` on this phone,
 * read once at load. No page shows it and no language choice is offered while it is off.
 */
export const GUJARATI_ON = (() => {
  try {
    return localStorage.getItem('uptimo.gujarati') === 'on';
  } catch {
    return false;
  }
})();

/**
 * The language a page is shown in: `pickLanguage(saved, company)` while `GUJARATI_ON`, otherwise always `en`
 * (a saved `gu` on this phone, a `gu` company or an unknown value all show English). `applyConfigLanguage` sets this.
 */
export function shownLanguage(saved: string | null, company: string | undefined): Language {
  return GUJARATI_ON ? pickLanguage(saved, company) : 'en';
}

function savedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

/** The account sheet's language choice: applied now and kept for this phone. */
export function chooseLanguage(lng: Language): Promise<void> {
  try {
    localStorage.setItem(LANGUAGE_KEY, lng);
  } catch {
    // Private browsing: the choice lasts until the page reloads.
  }
  return setLanguage(lng);
}

/**
 * Lay the plant's own Gujarati (setting `i18n.overrides`) over the bundled catalogue: the whole Gujarati bundle is
 * replaced from the two, so a cleared override falls back to the catalogue and no rebuild is needed (D7, D17).
 */
export function applyOverrides(overrides: UiOverrides): void {
  i18n.addResourceBundle('gu', 'translation', overlaidGu(gu, overrides), true, true);
}

/** Read the tenant language and its Gujarati overrides from `/config` and apply both (defaults to `en`). */
export function applyConfigLanguage(): void {
  // Skip when not signed in: an unauthenticated getConfig would 401 → redirect to /login and
  // loop on the sign-in screen.
  if (!getToken()) return;
  getConfig()
    .then((config) => {
      applyOverrides(config.i18nOverrides ?? {});
      return setLanguage(shownLanguage(savedLanguage(), config.language));
    })
    .catch(() => undefined);
}

export default i18n;
