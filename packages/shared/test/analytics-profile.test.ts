import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROFILE_KEYS, profilePatchSchema } from '../src/analytics.js';

describe('the plant profile', () => {
  it('starts from the legacy platform constants', () => {
    expect(DEFAULT_PROFILE).toMatchObject({
      hoursPerDay: 20,
      daysPerYear: 300,
      costPerHour: 1800,
      efficiencyPct: 20,
      whyWhyHours: 12,
      acSnoozeDays: 7,
      acFreqDays: 30,
      acFreqMin: 4,
    });
    expect(PROFILE_KEYS.filter((key) => key.startsWith('ac'))).toHaveLength(26);
  });

  it('takes numbers typed into a generated form', () => {
    expect(profilePatchSchema.parse({ costPerHour: '2500', acMttrMult: '1.5' })).toEqual({
      costPerHour: 2500,
      acMttrMult: 1.5,
    });
  });

  it.each([
    [{ hoursPerDay: 25 }],
    [{ hoursPerDay: 0 }],
    [{ daysPerYear: 400 }],
    [{ costPerHour: -1 }],
    [{ acFreqMin: 2.5 }],
    [{ acSnoozeDays: 0 }],
    [{ efficiencyPct: 101 }],
    [{ costPerHour: 'lots' }],
    [{ unknownKey: 1 }],
  ])('refuses nonsense %j', (patch) => {
    expect(profilePatchSchema.safeParse(patch).success).toBe(false);
  });
});
