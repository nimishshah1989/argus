// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { glossaryTakeaway, listsTakeaway, profileTakeaway } from '../settings-lists/model.js';

describe('S26-6 lists, glossary, profile: edges', () => {
  it('is null on empty lists', () => {
    expect(listsTakeaway([])).toBeNull();
    expect(listsTakeaway([{ page: 'wait_reason', n: 0 }])).toBeNull();
    expect(glossaryTakeaway([])).toBeNull();
  });

  it('on a tie the list first in order wins', () => {
    const counts = [
      { page: 'quick_problem' as const, n: 5 },
      { page: 'lockout_step' as const, n: 5 },
    ];
    expect(listsTakeaway(counts)).toEqual({ page: 'quick_problem', n: 5, total: 10 });
  });

  it('leaves inactive glossary terms out', () => {
    const off = { id: 'x', source: 'x', english: 'x', direction: 'gu' as const, active: false };
    const on = { ...off, id: 'y', direction: 'en' as const, active: true };
    expect(glossaryTakeaway([off, on])).toEqual({ total: 1, gu: 0, guLatn: 0, en: 1 });
  });

  it('never counts money keys the login cannot read, nor the row id and active flag', () => {
    const row = { id: 'p', active: true, prodHrsPerDay: 16, repeatDays: null };
    expect(profileTakeaway(row)).toEqual({ notSet: ['repeatDays'], total: 2 });
    const withMoney = { ...row, mmThroughput: null };
    expect(profileTakeaway(withMoney)).toEqual({
      notSet: ['mmThroughput', 'repeatDays'],
      total: 3,
    });
  });
});
