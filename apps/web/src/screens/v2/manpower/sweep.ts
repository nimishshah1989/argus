import { readable } from '../../../ui/v2/format.js';

/**
 * Sweep 706 (ADR 0041, batch D): Manpower's own sums in the kit's readable form (ADR 0036 R11). In
 * `manpower/adapter.ts`: `whole` (~57) → `(n) => sumText(n, 0)` and `oneDecimal` (~58) → `(n) => sumText(n, 1)`, so
 * the three `sumItems` calls (~96–98) and the team share's `total` (~129) print through `sumText`.
 */

/**
 * A sum the page adds up itself. Rule, in order:
 * 1. not finite → "—".
 * 2. Rounded to `digits` decimals, still under 1,00,000 in size → the page's current text, unchanged:
 *    digits 0 → `n.toLocaleString('en-IN')` ("1,234"); digits 1 →
 *    `n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` ("1,234.6", "0.0").
 * 3. otherwise `readable(n)` from `ui/v2/format.ts`: 2,50,000 → "2.50 lakh", 1,23,456.7 → "1.23 lakh",
 *    99,999.96 with digits 1 → "1.00 lakh", 1,50,00,000 → "1.50 cr".
 */
export function sumText(n: number, digits: 0 | 1): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(Number(n.toFixed(digits))) < 1e5)
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  return readable(n);
}
