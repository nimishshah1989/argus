/** The plant's own Gujarati, keyed by catalogue key (D17: a `setting`, laid over the bundled catalogue). */
export type UiOverrides = Record<string, string>;

/**
 * The bundled Gujarati with the plant's overrides on top: an override with text wins, a blank one or a key the
 * catalogue does not have is ignored. Blank values still fall back to English in i18next (D7).
 */
export function overlaidGu<T extends Record<string, string>>(gu: T, overrides: UiOverrides): T {
  const out = { ...gu };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in out && typeof value === 'string' && value.trim() !== '')
      out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/** The keys a plant still shows in English in Gujarati mode: no catalogue Gujarati and no override. */
export function untranslatedKeys(
  en: Record<string, string>,
  gu: Record<string, string>,
  overrides: UiOverrides,
): string[] {
  const shown = overlaidGu(gu, overrides);
  return Object.keys(en)
    .filter((key) => (shown[key] ?? '').trim() === '')
    .sort();
}
