import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  PROFILE_FIELDS,
  PROFILE_KEYS,
  profilePatchSchema,
  profileRuleProblem,
} from '../src/analytics.js';

describe('the plant profile', () => {
  it('starts from the legacy platform constants, under the legacy names', () => {
    expect(DEFAULT_PROFILE).toMatchObject({
      prodHrsPerDay: 20,
      workDaysPerYear: 300,
      efficiencyFactor: 20,
      whyWhyThresholdHours: 12,
      flHalfLife: 300,
      mmThroughput: 1800,
      mmTurnover: 150,
      mmSucc: 100,
      snoozeDays: 7,
      freqDays: 30,
      freqMin: 4,
    });
    expect(PROFILE_KEYS).toHaveLength(34);
  });

  it('marks the Money Matters numbers as money and gives every key an owner ticket', () => {
    expect(PROFILE_KEYS.filter((key) => PROFILE_FIELDS[key].money)).toEqual([
      'mmThroughput',
      'mmTurnover',
      'mmSucc',
    ]);
    for (const key of PROFILE_KEYS)
      expect(PROFILE_FIELDS[key].owner, key).toBeGreaterThanOrEqual(38);
  });

  it('takes what a generated form sends: every number as text, and the row switch sent back', () => {
    const form = {
      ...Object.fromEntries(PROFILE_KEYS.map((key) => [key, String(DEFAULT_PROFILE[key])])),
      mmThroughput: '2500',
      mttrMult: '1.5',
      active: true,
    };
    const parsed = profilePatchSchema.parse(form);
    expect(parsed).toMatchObject({ mmThroughput: 2500, mttrMult: 1.5, prodHrsPerDay: 20 });
    expect(profilePatchSchema.safeParse({ active: 'true' }).success).toBe(true);
  });

  it.each([
    [{ prodHrsPerDay: 25 }],
    [{ prodHrsPerDay: 0 }],
    [{ workDaysPerYear: 400 }],
    [{ mmThroughput: -1 }],
    [{ freqMin: 2.5 }],
    [{ snoozeDays: 0 }],
    [{ efficiencyFactor: 101 }],
    [{ mmThroughput: 'lots' }],
    [{ active: false }],
    [{ unknownKey: 1 }],
  ])('refuses nonsense %j', (patch) => {
    expect(profilePatchSchema.safeParse(patch).success).toBe(false);
  });

  it('refuses numbers that cannot both be true, naming the field to correct', () => {
    expect(profileRuleProblem(DEFAULT_PROFILE)).toBeNull();
    expect(profileRuleProblem({ ...DEFAULT_PROFILE, repeatMinDays: 8 })?.field).toBe(
      'repeatMinDays',
    );
    expect(profileRuleProblem({ ...DEFAULT_PROFILE, oldAge: 1, newMachDays: 400 })?.field).toBe(
      'newMachDays',
    );
  });
});
