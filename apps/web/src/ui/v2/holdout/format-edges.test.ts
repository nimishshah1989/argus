import { describe, expect, it } from 'vitest';
import { exact, readable, rupees } from '../format.js';

describe('readable numbers: edges', () => {
  it('chooses the unit after rounding', () => {
    expect(readable(9_999_999)).toBe('1.00 cr');
    expect(readable(99_999.9)).toBe('99,999.9');
    expect(readable(100_000)).toBe('1.00 lakh');
  });
  it('keeps the sign and prints a dash for what is not a number', () => {
    expect(readable(-622000)).toBe('-6.22 lakh');
    expect(readable(Number.NaN, 'hrs')).toBe('—');
    expect(rupees(Number.POSITIVE_INFINITY)).toBe('₹ —');
    expect(exact(Number.NaN)).toBe('—');
    expect(readable(0, 'hrs')).toBe('0 hrs');
  });
  it('rounds the exact value to 2 decimals at most', () => {
    expect(exact(1234567.891)).toBe('12,34,567.89');
  });
});
