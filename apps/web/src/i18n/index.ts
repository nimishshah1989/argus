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
  return i18n.changeLanguage(lng).then(() => undefined);
}

/** Read the tenant language from `/config` and apply it (defaults to `en`). */
export function applyConfigLanguage(): void {
  // Skip when not signed in: an unauthenticated getConfig would 401 → redirect to /login and
  // loop on the sign-in screen.
  if (!getToken()) return;
  getConfig()
    .then((config) => {
      if (config.language === 'gu') void setLanguage('gu');
      else void setLanguage('en');
    })
    .catch(() => undefined);
}

export default i18n;
