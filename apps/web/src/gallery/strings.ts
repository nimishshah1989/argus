import i18n from '../i18n/index.js';

export const galleryEn: Record<string, string> = {
  title: 'The v2 kit',
  intro:
    'Every part of the v2 kit, grouped as in docs/design/v2/KIT.md. Each screen below shows the parts in use.',
  language: 'Language',
  'language.en': 'English',
  'language.gu': 'Gujarati',
  theme: 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  screens: 'Screens on the kit',
  guBanner:
    "Real Gujarati: components show the live catalogue. Only the gallery's own labels are sample letters.",
  guSpecimen:
    'અ આ ઇ ઈ ઉ ઊ એ ઐ ઓ ઔ ક ખ ગ ઘ ચ છ જ ઝ ટ ઠ ડ ઢ ણ ત થ દ ધ ન પ ફ બ ભ મ ય ર લ વ શ સ હ ૦ ૧ ૨ ૩ ૪ ૫ ૬ ૭ ૮ ૯',
};

/** The gallery's own labels in sample letters, not translations. Components use the real catalogue. */
export const galleryGu: Record<string, string> = Object.fromEntries(
  Object.entries(galleryEn).map(([key, value]) => [
    key,
    key === 'guBanner' || key === 'guSpecimen' ? value : `ક ખ ગ · ${value}`,
  ]),
);

export function registerGalleryStrings(): void {
  i18n.addResourceBundle('en', 'gallery', galleryEn, true, true);
  i18n.addResourceBundle('gu', 'gallery', galleryGu, true, true);
}
