import { describe, expect, it } from 'vitest';
import { periodFrom } from '../period-toggle.js';

describe('periodFrom: edges', () => {
  it('a missing, empty or unknown period is days so far', () => {
    expect(periodFrom('')).toBe('sofar');
    expect(periodFrom('?period=')).toBe('sofar');
    expect(periodFrom('?period=year')).toBe('sofar');
    expect(periodFrom('?period=FULL')).toBe('sofar');
  });
  it('other params are ignored', () => {
    expect(periodFrom('?shift=A&period=full&line=2')).toBe('full');
    expect(periodFrom('?shift=full')).toBe('sofar');
    expect(periodFrom('period=full')).toBe('full');
  });
});
