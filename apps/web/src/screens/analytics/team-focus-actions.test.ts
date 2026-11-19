import { describe, expect, it } from 'vitest';
import { printedNumber, stakeText } from './team-focus-actions.js';
import { checklistTotals } from './checklist-view.js';

describe('Team Focus figures', () => {
  it('prints the hours at stake as the engine gave them, at least one decimal', () => {
    expect(stakeText(6.09)).toBe('6.09');
    expect(stakeText(5.1)).toBe('5.1');
    expect(stakeText(10)).toBe('10.0');
    expect(stakeText(12345.5)).toBe('12,345.5');
    expect(stakeText(123456.5)).toBe('1,23,456.5');
  });

  it('finds the number the engine printed in a count, a percentage or an amount of hours', () => {
    expect(printedNumber('31')).toBe(31);
    expect(printedNumber('0%')).toBe(0);
    expect(printedNumber('1,343 hrs')).toBe(1343);
    expect(printedNumber('2,145.5 hrs')).toBe(2145.5);
    expect(printedNumber('—')).toBeNull();
    expect(printedNumber('')).toBeNull();
  });
});

describe('the data checklist totals', () => {
  const counts = { bd_code: 4, bd_done: 82, log_gap: 2, mc_age: 32, mc_loc: 1, ww: 23, other: 5 };

  it('sums the engine counts into the log, the machine records and the analysis', () => {
    expect(checklistTotals({ counts })).toEqual({
      total: 149,
      sections: { log: 88, machines: 33, analysis: 23 },
    });
  });

  it('keeps a group it cannot place in the total only, and skips a count that is not a number', () => {
    expect(checklistTotals({ counts: { ww: 'x', zz: 3, bd_date: -2 } })).toEqual({
      total: 3,
      sections: { log: 0, machines: 0, analysis: 0 },
    });
  });

  it('has no totals for a figure that is not an object, and zero for one with no counts', () => {
    expect(checklistTotals(null)).toBeNull();
    expect(checklistTotals(5)).toBeNull();
    expect(checklistTotals({})).toEqual({
      total: 0,
      sections: { log: 0, machines: 0, analysis: 0 },
    });
  });
});
