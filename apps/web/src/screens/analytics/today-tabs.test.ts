// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dmy } from './action-center.js';
import { priorDate } from './today-change.js';

describe('the dates in a lede', () => {
  it('prints the as-of date and the comparison date as dd-mm-yyyy', () => {
    expect(dmy('2026-11-11')).toBe('11-11-2026');
    expect(dmy(priorDate('2026-11-11'))).toBe('12-10-2026');
  });
});
