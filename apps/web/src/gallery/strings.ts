import i18n from '../i18n/index.js';

export const galleryEn: Record<string, string> = {
  title: 'Design gallery',
  language: 'Language',
  'language.en': 'English',
  'language.gu': 'Gujarati (placeholder)',
  accent: 'Accent',
  'accent.blue': 'Blue',
  'accent.teal': 'Deep teal',
  'section.tokens': 'Tokens',
  'section.components': 'Components',
  'section.layout': 'Layout',
  'section.status': 'Status',
  'tokens.colours': 'Colours',
  'tokens.type': 'Type',
  'tokens.typeSample': 'Machine stopped 08:30',
  'tokens.space': 'Space',
  'tokens.radius': 'Radius',
  'tokens.shadow': 'Shadow',
  'tokens.motion': 'Motion',
  'tokens.target': 'Target size',
  'sample.primary': 'Primary action',
  'sample.secondary': 'Secondary action',
  'sample.label': 'Machine',
  'sample.placeholder': 'Search machines',
  'sample.cardTitle': 'Card title',
  'sample.cardBody': 'Card content sits on a white surface.',
  'sample.openSheet': 'Open sheet',
  'sample.sheetTitle': 'Sheet title',
  'sample.sheetBody': 'Sheet content.',
  'sample.box': 'Box',
  guBanner:
    'Gujarati placeholder: sample letters only, not translations. Real Gujarati arrives with ticket 24.',
  guSpecimen:
    'અ આ ઇ ઈ ઉ ઊ એ ઐ ઓ ઔ ક ખ ગ ઘ ચ છ જ ઝ ટ ઠ ડ ઢ ણ ત થ દ ધ ન પ ફ બ ભ મ ય ર લ વ શ સ હ ૦ ૧ ૨ ૩ ૪ ૫ ૬ ૭ ૮ ૯',
};

/** Marked placeholder script, not a translation (nothing is machine-translated). */
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
