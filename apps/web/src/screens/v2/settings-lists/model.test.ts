// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROFILE_KEYS, profileReplySchema } from '@uptimo/shared/analytics';
import type { GlossaryReply } from '@uptimo/shared/plant-settings';
import type { ProfileRow } from './analytics-profile-spec.js';
import { glossaryTakeaway, listsHub, listsTakeaway, profileTakeaway } from './model.js';

/** What `GET /analytics-profile` really sends: every number, never null (the server fills the defaults). */
const reply = (changes: Record<string, number> = {}): ProfileRow =>
  profileReplySchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    ...DEFAULT_PROFILE,
    ...changes,
    active: true,
  }) as ProfileRow;

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

  it('a fresh plant has every profile number still on the default', () => {
    expect(profileTakeaway(reply())).toEqual({
      onDefault: [...PROFILE_KEYS],
      total: PROFILE_KEYS.length,
    });
  });

  it('a number the plant changed is no longer on the default', () => {
    const takeaway = profileTakeaway(reply({ prodHrsPerDay: DEFAULT_PROFILE.prodHrsPerDay - 1 }));
    expect(takeaway.total).toBe(PROFILE_KEYS.length);
    expect(takeaway.onDefault).toHaveLength(PROFILE_KEYS.length - 1);
    expect(takeaway.onDefault).not.toContain('prodHrsPerDay');
  });

  it('the hub has no count for a list still loading, and is not ready', () => {
    const hub = listsHub([
      { page: 'wait_reason', items: [{ active: true }, { active: false }], failed: false },
      { page: 'work_type', items: undefined, failed: false },
    ]);
    expect(hub).toEqual({
      state: 'loading',
      counts: [
        { page: 'wait_reason', n: 1 },
        { page: 'work_type', n: null },
      ],
    });
  });

  it('a failed list puts the hub in its error state, with no count for that list', () => {
    const hub = listsHub([
      { page: 'wait_reason', items: [{ active: true }], failed: false },
      { page: 'work_type', items: undefined, failed: true },
    ]);
    expect(hub.state).toBe('error');
    expect(hub.counts[1]).toEqual({ page: 'work_type', n: null });
  });
});
