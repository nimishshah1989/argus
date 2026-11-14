import { describe, expect, it } from 'vitest';
import { MAX_POLICY_MINUTES, slaPoliciesUpdateSchema, slaProjectionSchema } from '../src/sla.js';

const base = (extra: object) =>
  ['S1', 'S2', 'S3', 'S4'].map((severity) => ({
    severity,
    ackMinutes: 5,
    restoreMinutes: 60,
    businessHoursOnly: false,
    ...extra,
  }));
const accepts = (extra: object) =>
  slaPoliciesUpdateSchema.safeParse({ policies: base(extra) }).success;

describe('pause maximum and sign-off time in the policy contract', () => {
  it('accepts whole minutes from 1 to 30 days, null, or nothing', () => {
    expect(MAX_POLICY_MINUTES).toBe(43_200);
    for (const ok of [1, 90, 43_200, null, undefined]) {
      expect(accepts({ pauseMaxMinutes: ok, handbackMinutes: ok })).toBe(true);
    }
  });

  it('refuses zero, negative, fractional, too long and non-numbers', () => {
    for (const bad of [0, -1, 2.5, 43_201, '60', Number.NaN]) {
      expect(accepts({ pauseMaxMinutes: bad })).toBe(false);
      expect(accepts({ handbackMinutes: bad })).toBe(false);
    }
  });

  it('a ticket’s clocks may carry a pause clock, which is absent (never null) when there is none', () => {
    const timer = {
      id: 't:pause',
      state: 'running',
      breached: false,
      dueAt: null,
      pausedAt: null,
      stoppedAt: null,
      remainingMinutes: 3,
    };
    const two = { ack: null, restore: null };
    expect(slaProjectionSchema.safeParse(two).success).toBe(true);
    expect(slaProjectionSchema.safeParse({ ...two, pause: timer }).success).toBe(true);
    expect(slaProjectionSchema.safeParse({ ...two, pause: null }).success).toBe(false);
    expect(slaProjectionSchema.safeParse({ ...two, other: timer }).success).toBe(false);
  });
});
