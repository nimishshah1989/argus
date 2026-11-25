// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { moneyText } from '../sweep.js';

/** Sweep #706, batch D, hidden: Compare's money at the edges. */

describe('moneyText at the edges', () => {
  it('prints a dash for a value that is not finite', () => {
    expect(moneyText(Number.NaN)).toBe('—');
    expect(moneyText(Infinity)).toBe('—');
  });

  it('keeps zero and a negative under a lakh in the page’s own text', () => {
    expect(moneyText(0)).toBe('₹ 0.00 lakh');
    expect(moneyText(-20000)).toBe('₹ -0.20 lakh');
  });

  it('switches at exactly one lakh, and to crore after rounding', () => {
    expect(moneyText(99999)).toBe('₹ 1.00 lakh');
    expect(moneyText(100000)).toBe('₹ 1.00 lakh');
    expect(moneyText(9999999)).toBe('₹ 1.00 cr');
    expect(moneyText(-250000)).toBe('₹ -2.50 lakh');
  });
});
