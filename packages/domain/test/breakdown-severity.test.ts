import { describe, expect, it } from 'vitest';
import { severityOf } from '../src/analytics/breakdown-log.js';

/** Bhavin's `dt>4 ? red : dt>1 ? amber : green`, strict: the bands are over 4 hours and over 1 hour. */
describe('how long a stop the log tags', () => {
  it.each([
    [4.01, 'long'],
    [4, 'watch'],
    [3.99, 'watch'],
    [1.01, 'watch'],
    [1, ''],
    [0.5, ''],
    [0, ''],
    [Number.NaN, ''],
    [Number.POSITIVE_INFINITY, ''],
  ] as const)('%s hours is %j', (hours, expected) => {
    expect(severityOf(hours)).toBe(expected);
  });
});
