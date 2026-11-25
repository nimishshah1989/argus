// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sumText } from './sweep.js';

/** Sweep #706, batch D: Manpower's own sums keep their text under a lakh and read as the kit's from a lakh up. */

describe('sumText', () => {
  it('keeps the page’s whole and one-decimal text under a lakh', () => {
    expect(sumText(1234, 0)).toBe('1,234');
    expect(sumText(1234.56, 1)).toBe('1,234.6');
    expect(sumText(12, 1)).toBe('12.0');
  });

  it('reads lakh-scale sums the kit’s way', () => {
    expect(sumText(250000, 0)).toBe('2.50 lakh');
    expect(sumText(123456.7, 1)).toBe('1.23 lakh');
  });
});
