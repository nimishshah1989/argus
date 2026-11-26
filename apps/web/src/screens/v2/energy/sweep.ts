import { readable } from '../../../ui/v2/format.js';

/**
 * Sweep 706 (ADR 0041, batch D): Energy's KVA figures in the kit's readable form (ADR 0036 R11). Every
 * `oneDecimal(` call in `energy/adapter.ts` and `energy/takeaways.ts` becomes `kvaText(`, and `oneDecimal` is deleted.
 * The chart's numbers (`rounded`, adapter ~36) stay numbers: a chart value is not text.
 */

/**
 * A KVA figure as the page prints it. Rule, in order:
 * 1. not finite → "—".
 * 2. Rounded to one decimal, still under 1,00,000 in size → the page's current text, unchanged:
 *    `n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` ("20.0", "1,234.6", "0.0").
 * 3. otherwise `readable(n)` from `ui/v2/format.ts`: 2,50,000 → "2.50 lakh", 99,999.96 → "1.00 lakh",
 *    -1,50,000 → "-1.50 lakh", 1,50,00,000 → "1.50 cr".
 */
export function kvaText(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(Number(n.toFixed(1))) < 1e5)
    return n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return readable(n);
}
