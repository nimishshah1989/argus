import { en } from './en.js';

/**
 * Gujarati placeholder catalogue (SPEC 1.11): the same keys as `en` with empty values. Empty
 * values fall back to English via `fallbackLng: 'en'` + `returnEmptyString: false`. Real
 * Gujarati strings are an external input, not machine-translated here.
 */
export const gu: Record<string, string> = Object.fromEntries(
  Object.keys(en).map((key) => [key, '']),
);
