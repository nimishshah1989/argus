// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GlossaryReply } from '@uptimo/shared/plant-settings';
import { glossaryTakeaway, listsTakeaway, profileTakeaway } from './model.js';

const term = (id: string, direction: GlossaryReply['direction'], active = true): GlossaryReply => ({
  id,
  source: id,
  english: 'Breakdown',
  direction,
  active,
});

describe('S26-6 lists, glossary, profile model', () => {
  it('names the longest list', () => {
    const counts = [
      { page: 'wait_reason' as const, n: 9 },
      { page: 'failure_code' as const, n: 31 },
      { page: 'work_type' as const, n: 40 },
    ];
    expect(listsTakeaway(counts)).toEqual({ page: 'work_type', n: 40, total: 80 });
  });

  it('counts glossary terms by script', () => {
    const terms = [term('a', 'gu'), term('b', 'gu'), term('c', 'gu-Latn'), term('d', 'en')];
    expect(glossaryTakeaway(terms)).toEqual({ total: 4, gu: 2, guLatn: 1, en: 1 });
  });

  it('lists the profile numbers not set', () => {
    const row = {
      id: 'p',
      active: true,
      prodHrsPerDay: null,
      workDaysPerYear: 300,
      flHalfLife: null,
    };
    expect(profileTakeaway(row)).toEqual({ notSet: ['prodHrsPerDay', 'flHalfLife'], total: 3 });
  });
});
