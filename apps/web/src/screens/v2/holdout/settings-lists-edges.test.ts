// @vitest-environment node
import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  PROFILE_FIELDS,
  PROFILE_KEYS,
  profileReplySchema,
  type ProfileKey,
} from '@uptimo/shared/analytics';
import { en } from '@uptimo/shared/i18n';
import { analyticsProfileSpec, type ProfileRow } from '../settings-lists/analytics-profile-spec.js';
import {
  glossaryTakeaway,
  listsHub,
  listsTakeaway,
  profileTakeaway,
} from '../settings-lists/model.js';

/** A valid value that differs from the key's default. */
const other = (key: ProfileKey) => {
  const field = PROFILE_FIELDS[key];
  return field.default === field.max ? field.min : field.max;
};

/** A real `/analytics-profile` reply: every number, never null. */
const reply = (changes: Partial<Record<ProfileKey, number>> = {}): ProfileRow =>
  profileReplySchema.parse({
    id: '00000000-0000-4000-8000-000000000002',
    ...DEFAULT_PROFILE,
    ...changes,
    active: true,
  }) as ProfileRow;

const tag = (row: ProfileRow) =>
  (
    analyticsProfileSpec.look!(row, { t: (key: string) => key } as never).tag as ReactElement<{
      text: string;
      tone: string;
    }>
  ).props;

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

  it('the reply schema never lets a null through, so null cannot mean "not set"', () => {
    expect(() => reply({ prodHrsPerDay: null as never })).toThrow();
  });

  it('a changed money number counts as set; total is always every profile number', () => {
    const money = PROFILE_KEYS.find((key) => PROFILE_FIELDS[key].money)!;
    const takeaway = profileTakeaway(reply({ [money]: other(money) }));
    expect(takeaway.total).toBe(PROFILE_KEYS.length);
    expect(takeaway.onDefault).toEqual(PROFILE_KEYS.filter((key) => key !== money));
  });

  it('a plant that changed every number has none on the default and a green tag', () => {
    const all = Object.fromEntries(PROFILE_KEYS.map((key) => [key, other(key)]));
    const row = reply(all);
    expect(profileTakeaway(row)).toEqual({ onDefault: [], total: PROFILE_KEYS.length });
    expect(tag(row)).toMatchObject({ text: 'lists.profile.set', tone: 'gain' });
  });

  it('one number on the default is enough for the risk tag', () => {
    const all = Object.fromEntries(PROFILE_KEYS.map((key) => [key, other(key)]));
    const row = reply({ ...all, gapDays: DEFAULT_PROFILE.gapDays });
    expect(profileTakeaway(row).onDefault).toEqual(['gapDays']);
    expect(tag(row)).toMatchObject({ text: 'lists.profile.notSet', tone: 'risk' });
  });

  it('the hub: error wins over loading, order is kept, an empty list that arrived counts 0', () => {
    const hub = listsHub([
      { page: 'lockout_step', items: undefined, failed: false },
      { page: 'quick_problem', items: [], failed: false },
      { page: 'failure_code', items: undefined, failed: true },
    ]);
    expect(hub).toEqual({
      state: 'error',
      counts: [
        { page: 'lockout_step', n: null },
        { page: 'quick_problem', n: 0 },
        { page: 'failure_code', n: null },
      ],
    });
  });

  it('the hub is ready only when every list arrived; off entries never count', () => {
    const hub = listsHub([
      { page: 'wait_reason', items: [{ active: false }, { active: true }], failed: false },
      { page: 'work_type', items: [{ active: false }], failed: false },
    ]);
    expect(hub.state).toBe('ready');
    expect(hub.counts.map((count) => count.n)).toEqual([1, 0]);
    expect(listsHub([]).state).toBe('ready');
  });

  it('the profile copy says "on the default", never "not set"', () => {
    expect(en['lists.profile.takeaway']).toBe('{{n}} of {{total}} numbers still on the default');
    expect(en['lists.profile.progress']).toBe('{{n}} of {{total}} numbers set by the plant');
    expect(en['lists.profile.notSet']).toBe('Defaults in use');
    expect(en['lists.profile.set']).toBe('All set');
  });

  it('the hub never shows a tile number before its list arrives', () => {
    const view = readFileSync(new URL('../settings-lists/View.tsx', import.meta.url), 'utf8');
    expect(view).not.toMatch(/counts\[index\]!\.n/);
    expect(view).not.toMatch(/\bheaded\b/);
  });

  it('the coverage doc no longer says money keys are hidden from the profile reply', () => {
    const doc = readFileSync(
      new URL('../../../../../../docs/design/v2/scope/settings-lists.md', import.meta.url),
      'utf8',
    );
    expect(doc).not.toMatch(/money keys the login cannot read/);
    expect(doc).not.toMatch(/money hidden from who may not read it/);
    expect(doc).toMatch(/ADR 0056/);
  });
});
