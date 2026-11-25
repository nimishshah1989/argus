/** Keys with no Gujarati (no catalogue text, no plant override) out of every English key. */
export type TranslationsTakeaway = { missing: number; total: number };

/** `missing` = `missingTranslations(overrides).length`; `total` = the number of keys in the English catalogue. */
export function translationsTakeaway(
  overrides: Readonly<Record<string, string>>,
): TranslationsTakeaway {
  void overrides;
  throw new Error('not implemented');
}
