import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  PROFILE_FIELDS,
  PROFILE_KEYS,
  profileReplySchema,
} from '@uptimo/shared/analytics';
import { en, gu } from '@uptimo/shared/i18n';
import { PROFILE_GROUPS, analyticsProfileSpec, type ProfileRow } from './analytics-profile-spec.js';

/** The tag the row shows for a real server reply (every number filled, never null). */
const tagOf = (changes: Record<string, number>) => {
  const row = profileReplySchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    ...DEFAULT_PROFILE,
    ...changes,
    active: true,
  }) as ProfileRow;
  const look = analyticsProfileSpec.look!(row, { t: (key: string) => key } as never);
  return (look.tag as ReactElement<{ text: string; tone: string }>).props;
};

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('the analytics profile spec accounts for its reply keys (D05)', () => {
  it('every reply key is a field or declared hidden with a reason', () => {
    if (!analyticsProfileSpec.schema) throw new Error('the profile has no reply schema to check');
    const fields = new Set<string>(analyticsProfileSpec.fields.map((field) => field.name));
    const hidden = analyticsProfileSpec.hidden ?? {};
    const keys = Object.keys(analyticsProfileSpec.schema.shape);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (STRUCTURAL.has(key)) continue;
      expect(fields.has(key) || key in hidden, `profile.${key} is neither field nor hidden`).toBe(
        true,
      );
      if (key in hidden) expect(hidden[key]!.trim(), `profile.${key} has no reason`).not.toBe('');
    }
  });

  it('asks for every profile number, in the shared order, so the four groups stay together', () => {
    expect(analyticsProfileSpec.fields.map((field) => field.name)).toEqual(PROFILE_KEYS);
    expect(PROFILE_GROUPS).toEqual(['plant', 'forecast', 'money', 'actionCenter']);
    const groups = PROFILE_KEYS.map((key) => PROFILE_FIELDS[key].group);
    // Each group is one run of fields: the screen never interleaves plant, forecast, money and action centre.
    const runs = groups.filter((group, index) => group !== groups[index - 1]);
    expect(runs).toEqual(PROFILE_GROUPS);
  });

  it('shows the money numbers as fields too (the server hides them from everyone but heads and admin)', () => {
    const money = PROFILE_KEYS.filter((key) => PROFILE_FIELDS[key].money);
    expect(money.length).toBeGreaterThan(0);
    const fields = analyticsProfileSpec.fields.map((field) => field.name);
    for (const key of money) expect(fields).toContain(key);
    expect(analyticsProfileSpec.hidden ?? {}).not.toHaveProperty('mmThroughput');
  });

  it('names every field in both catalogues', () => {
    const english = Object.keys(en);
    const gujarati = Object.keys(gu);
    for (const field of analyticsProfileSpec.fields) {
      expect(english, field.labelKey).toContain(field.labelKey);
      expect(gujarati, field.labelKey).toContain(field.labelKey);
    }
    expect(english).toContain(analyticsProfileSpec.titleKey);
  });

  it('tags a fresh plant "Defaults in use", not "Set"', () => {
    expect(tagOf({})).toMatchObject({ text: 'lists.profile.notSet', tone: 'risk' });
  });
});
