/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
/** Readable numbers (ADR 0036 R11): rounded for reading on screen, exact for tooltips and Excel. */

/**
 * A figure rounded for reading. |value| under 1,00,000: Indian grouping, at most 1 decimal ("45,000", "12.5").
 * From 1 lakh: "X.XX lakh"; from 1 crore: "X.XX cr" — the unit is chosen after rounding (9,999,999 → "1.00 cr").
 * The sign is kept; `unit` follows after one space ("6.22 lakh hrs"); a value that is not finite prints "—".
 */
export function readable(value: number, unit?: string): string {
  throw new Error('not implemented');
}

/** Money: "₹ " then `readable(value)` ("₹ 1.20 cr", "₹ 45,000"). */
export function rupees(value: number): string {
  throw new Error('not implemented');
}

/** The exact value: Indian grouping, up to 2 decimals, `unit` after one space ("6,22,000.5 hrs"); not finite → "—". */
export function exact(value: number, unit?: string): string {
  throw new Error('not implemented');
}
