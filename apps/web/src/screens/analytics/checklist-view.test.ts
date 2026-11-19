import { describe, expect, it } from 'vitest';
import { checklistTotals } from './checklist-view.js';

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
