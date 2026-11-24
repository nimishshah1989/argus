/** Readable numbers (ADR 0036 R11): rounded for reading on screen, exact for tooltips and Excel. */

const indian = (n: number, max: number) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: max });
const withUnit = (text: string, unit?: string) => (unit ? `${text} ${unit}` : text);

/**
 * A figure rounded for reading. |value| under 1,00,000: Indian grouping, at most 1 decimal ("45,000", "12.5").
 * From 1 lakh: "X.XX lakh"; from 1 crore: "X.XX cr" — the unit is chosen after rounding (9,999,999 → "1.00 cr").
 * The sign is kept; `unit` follows after one space ("6.22 lakh hrs"); a value that is not finite prints "—".
 */
export function readable(value: number, unit?: string): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const plain = Number(abs.toFixed(1));
  const lakh = Number((abs / 1e5).toFixed(2));
  let text: string;
  if (plain < 1e5) text = sign + indian(plain, 1);
  else if (lakh < 100) text = `${sign}${lakh.toFixed(2)} lakh`;
  else text = `${sign}${(abs / 1e7).toFixed(2)} cr`;
  return withUnit(text, unit);
}

/** Money: "₹ " then `readable(value)` ("₹ 1.20 cr", "₹ 45,000"). */
export function rupees(value: number): string {
  return `₹ ${readable(value)}`;
}

/** The exact value: Indian grouping, up to 2 decimals, `unit` after one space ("6,22,000.5 hrs"); not finite → "—". */
export function exact(value: number, unit?: string): string {
  return Number.isFinite(value) ? withUnit(indian(value, 2), unit) : '—';
}
