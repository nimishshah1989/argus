import { describe, expect, it } from 'vitest';
import { statusOf } from '../status.js';

describe('statusOf: edges', () => {
  it('counts equal as good and the band edge as watch', () => {
    expect(statusOf({ value: 90, target: 90, better: 'higher' })).toBe('good');
    expect(statusOf({ value: 81, target: 90, better: 'higher' })).toBe('watch');
    expect(statusOf({ value: 80.9, target: 90, better: 'higher' })).toBe('bad');
    expect(statusOf({ value: 2.15, target: 2, better: 'lower' })).toBe('watch');
  });
  it('treats a zero target and a custom band', () => {
    expect(statusOf({ value: 0, target: 0, better: 'lower' })).toBe('good');
    expect(statusOf({ value: 0.1, target: 0, better: 'lower' })).toBe('bad');
    expect(statusOf({ value: 70, target: 90, better: 'higher', band: 0.25 })).toBe('watch');
  });
  it('is neutral when a number is missing', () => {
    expect(statusOf({ value: Number.NaN, target: 90, better: 'higher' })).toBe('neutral');
    expect(statusOf({ value: 5, target: Number.NaN, better: 'higher' })).toBe('neutral');
  });
});
