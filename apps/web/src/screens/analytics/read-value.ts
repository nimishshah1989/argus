/**
 * Defensive readers for the analytics engine's figure values. The 39a engine may not be merged, so a value is
 * untrusted JSON: these helpers turn it into plain data or nothing, never inventing a number or a word.
 */

export type Bag = Record<string, unknown>;

export const bag = (value: unknown): Bag | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Bag) : null;

export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

export const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const texts = (value: unknown): string[] =>
  list(value).filter((item): item is string => text(item) !== null);

export const pickText = (source: Bag, ...keys: string[]): string | null => {
  for (const key of keys) {
    const found = text(source[key]);
    if (found !== null) return found;
  }
  return null;
};

export const pickNum = (source: Bag, ...keys: string[]): number | null => {
  for (const key of keys) {
    const found = num(source[key]);
    if (found !== null) return found;
  }
  return null;
};

/** A value the engine printed as text or as a number, for a table cell or a KPI. */
export const printable = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};
