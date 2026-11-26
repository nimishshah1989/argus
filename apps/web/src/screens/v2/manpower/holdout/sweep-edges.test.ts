// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sumText } from '../sweep.js';

/** Sweep 706, batch D, hidden: Manpower's sums at the edges. */

describe('sumText at the edges', () => {
  it('prints a dash for a sum that is not finite', () => {
    expect(sumText(Number.NaN, 0)).toBe('—');
    expect(sumText(Infinity, 1)).toBe('—');
  });

  it('keeps zero in the page’s own form', () => {
    expect(sumText(0, 0)).toBe('0');
    expect(sumText(0, 1)).toBe('0.0');
  });

  it('decides after rounding to the digits asked, and turns to crore', () => {
    expect(sumText(99999.94, 1)).toBe('99,999.9');
    expect(sumText(99999.96, 1)).toBe('1.00 lakh');
    expect(sumText(99999, 0)).toBe('99,999');
    expect(sumText(100000, 0)).toBe('1.00 lakh');
    expect(sumText(15000000, 0)).toBe('1.50 cr');
  });
});
