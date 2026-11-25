import { rupees } from '../../../ui/v2/format.js';

const NB = ' ';

/**
 * Sweep #706 (ADR 0041, batch D): Compare's money in the kit's readable form (ADR 0036 R11).
 * Pure; the adapter's `lakh` calls (`metrics` money row and `KPI.money.show`) become `moneyText`.
 */

/**
 * Rupees as Compare prints them. Rule, in order:
 * 1. not finite → "—".
 * 2. |rupees| under 1,00,000 → the page's current text, unchanged: `₹ X.XX lakh` with no-break spaces
 *    (U+00A0) around the figure, X.XX = (rupees / 1,00,000).toFixed(2); e.g. 40,000 → "₹ 0.40 lakh" and a negative
 *    keeps its sign ("₹ -0.20 lakh").
 * 3. otherwise `rupees(value)` from `ui/v2/format.ts` (plain spaces): 38,23,000 → "₹ 38.23 lakh", 1,20,00,000 →
 *    "₹ 1.20 cr".
 */
export function moneyText(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e5) return `₹${NB}${(value / 1e5).toFixed(2)}${NB}lakh`;
  return rupees(value);
}
