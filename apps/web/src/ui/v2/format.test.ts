import { describe, expect, it } from 'vitest';
import { exact, readable, rupees } from './format.js';

describe('readable numbers (ADR 0036 R11)', () => {
  it('rounds lakhs and crores for reading and keeps the unit', () => {
    expect(readable(622000, 'hrs')).toBe('6.22 lakh hrs');
    expect(readable(12_345_678)).toBe('1.23 cr');
    expect(readable(45000)).toBe('45,000');
    expect(readable(12.54)).toBe('12.5');
  });

  it('prints money with the rupee sign', () => {
    expect(rupees(12_000_000)).toBe('₹ 1.20 cr');
    expect(rupees(45000)).toBe('₹ 45,000');
  });

  it('keeps the exact value for tooltips and Excel', () => {
    expect(exact(622000.5, 'hrs')).toBe('6,22,000.5 hrs');
  });
});
