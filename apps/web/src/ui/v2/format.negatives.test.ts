import { describe, expect, it } from 'vitest';
import { exact, readable, rupees } from './format.js';

describe('small negatives never print a signed zero', () => {
  it('rounds first, then takes the sign', () => {
    expect(readable(-0.04, 'hrs')).toBe('0 hrs');
    expect(rupees(-0.03)).toBe('₹ 0');
    expect(exact(-0.001)).toBe('0');
    expect(readable(-0)).toBe('0');
    expect(readable(-0.06)).toBe('-0.1');
    expect(readable(-622000)).toBe('-6.22 lakh');
  });
});
