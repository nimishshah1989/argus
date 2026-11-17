import { en, gu, untranslatedKeys } from '@uptimo/shared/i18n';

/** Where the plant's Gujarati lives (D17: a `setting`, no new table). */
export const OVERRIDES_KEY = 'i18n.overrides';

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface TranslationRow {
  key: string;
  en: string;
}

function asOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, text]) => typeof text === 'string'),
  ) as Record<string, string>;
}

/** The plant's saved overrides from `GET /settings`; an empty map when the plant never set one. */
export function storedOverrides(rows: SettingRow[]): Record<string, string> {
  return asOverrides(rows.find((row) => row.key === OVERRIDES_KEY)?.value);
}

/** The keys with no Gujarati in the catalogue and no override, each with the English it falls back to. */
export function missingTranslations(overrides: Record<string, string>): TranslationRow[] {
  const english = en as Record<string, string>;
  return untranslatedKeys(english, gu as Record<string, string>, overrides).map((key) => ({
    key,
    en: english[key]!,
  }));
}

/** What the setting becomes on save: the stored map plus the admin's text, trimmed; an empty box changes nothing. */
export function savedOverrides(
  stored: Record<string, string>,
  drafts: Record<string, string>,
): Record<string, string> {
  const next = { ...stored };
  for (const [key, text] of Object.entries(drafts)) {
    if (text.trim() !== '') next[key] = text.trim();
  }
  return next;
}

/** Rows whose key or English contains the search text, ignoring case; every row when the box is empty. */
export function searchTranslations(rows: TranslationRow[], query: string): TranslationRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return rows;
  return rows.filter(
    (row) => row.key.toLowerCase().includes(needle) || row.en.toLowerCase().includes(needle),
  );
}
