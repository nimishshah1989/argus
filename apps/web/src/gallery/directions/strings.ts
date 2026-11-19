import i18n from '../../i18n/index.js';

/** The preview's own labels, in the `directions` namespace; Gujarati is sample letters, as the gallery's are. */
export function addStrings(en: Record<string, string>): void {
  const gu = Object.fromEntries(
    Object.entries(en).map(([key, value]) => [key, `ક ખ ગ · ${value}`]),
  );
  i18n.addResourceBundle('en', 'directions', en, true, true);
  i18n.addResourceBundle('gu', 'directions', gu, true, true);
}
