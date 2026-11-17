/**
 * The platform prints numbers and percentages through `toLocaleString`, which groups thousands and rounds halves
 * away from zero. A figure ports that text exactly (ticket 39), so formatting lives here once and never re-rounds.
 */

/** A metadata or workbook value as a finite number, or null when it is absent or blank. */
export function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Round to `decimals`, halves away from zero (`toLocaleString`'s own rounding, never a binary surprise). */
export function roundValue(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The platform's grouped, fixed-decimal text: `1,552.8`, `2,970`, `4.20`. */
export function formatNumber(value: number, decimals: number): string {
  const rounded = roundValue(value, decimals);
  const [integer = '0', fraction = ''] = Math.abs(rounded).toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = rounded < 0 ? '-' : '';
  return decimals > 0 ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`;
}

/** A fraction as the platform's percentage text: `52.28%`. */
export function formatPercent(fraction: number): string {
  return `${formatNumber(fraction * 100, 2)}%`;
}

/** A machine metadata number (`length`, `width`, `efficiency`), or null. */
export const metadataNumber = (machine: { metadata: Record<string, unknown> }, key: string) =>
  numberValue(machine.metadata[key]);

/** A label with its whitespace collapsed, so `Cnc Sliding Head  Automatic Lathe` is one category. */
export const normalizeLabel = (text: string): string => text.trim().replace(/\s+/g, ' ');
