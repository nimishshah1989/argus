import { describe, expect, it } from 'vitest';
import { nextRef } from '../src/refs.js';

describe('refs', () => {
  it('formats the next BD reference', () => {
    expect(nextRef('BD', 150)).toBe('BD-0150');
    expect(nextRef('BD', 1)).toBe('BD-0001');
    expect(nextRef('WR', 99)).toBe('WR-0099');
  });
});
