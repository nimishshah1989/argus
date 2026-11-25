// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { kvaText } from '../sweep.js';

/** Sweep 706, batch D, hidden: Energy's KVA text at the edges. */

describe('kvaText at the edges', () => {
  it('prints a dash for a value that is not finite', () => {
    expect(kvaText(Number.NaN)).toBe('—');
    expect(kvaText(-Infinity)).toBe('—');
  });

  it('keeps zero and small loads at one decimal', () => {
    expect(kvaText(0)).toBe('0.0');
    expect(kvaText(99999.94)).toBe('99,999.9');
  });

  it('decides after rounding, keeps the sign, and turns to crore', () => {
    expect(kvaText(99999.96)).toBe('1.00 lakh');
    expect(kvaText(100000)).toBe('1.00 lakh');
    expect(kvaText(-150000)).toBe('-1.50 lakh');
    expect(kvaText(9999999)).toBe('1.00 cr');
  });
});
