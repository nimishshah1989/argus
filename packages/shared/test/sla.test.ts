import { describe, expect, it } from 'vitest';
import { slaPoliciesUpdateSchema } from '../src/sla.js';

const policies = [
  { severity: 'S1', ackMinutes: 5, restoreMinutes: 60, businessHoursOnly: false },
  { severity: 'S2', ackMinutes: 10, restoreMinutes: 120, businessHoursOnly: false },
  { severity: 'S3', ackMinutes: 15, restoreMinutes: 240, businessHoursOnly: true },
  { severity: 'S4', ackMinutes: 30, restoreMinutes: 480, businessHoursOnly: false },
] as const;

describe('SLA policy update contract', () => {
  it('accepts exactly four unique severity policies', () => {
    expect(slaPoliciesUpdateSchema.parse({ policies })).toEqual({ policies });
  });

  it('rejects duplicate or missing severities and non-positive minutes', () => {
    expect(
      slaPoliciesUpdateSchema.safeParse({
        policies: policies.map((p) => ({ ...p, severity: 'S1' })),
      }).success,
    ).toBe(false);
    expect(slaPoliciesUpdateSchema.safeParse({ policies: policies.slice(1) }).success).toBe(false);
    expect(
      slaPoliciesUpdateSchema.safeParse({
        policies: policies.map((p, i) => (i === 0 ? { ...p, ackMinutes: 0 } : p)),
      }).success,
    ).toBe(false);
  });
});
