import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getConfig, getToken } from '../api.js';
import { en, gu } from '@uptimo/shared/i18n';

export const SUPPORTED_LANGUAGES = ['en', 'gu'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, gu: { translation: gu } },
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

/** Read the tenant language from `/config` and apply it (defaults to `en`). */
export function applyConfigLanguage(): void {
  // Skip when not signed in: an unauthenticated getConfig would 401 → redirect to /login and
  // loop on the sign-in screen.
  if (!getToken()) return;
  getConfig()
    .then((config) => void setLanguage(pickLanguage(savedLanguage(), config.language)))
    .catch(() => undefined);
}

export default i18n;
