import { describe, expect, it } from 'vitest';
import { pmPlanReplySchema, type PmPlanReply } from '@uptimo/shared/pm';
import { pmPlanNextDue, pmPlansSpec } from './pm-plans-spec.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key is
 * neither a form field nor listed as hidden/read-only with a reason. `id` and `active` are the row's identity
 * and switch, which the pattern itself reads.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('the PM plans settings spec accounts for its reply keys (D05)', () => {
  it('every reply key is a field, hidden or read-only with a reason', () => {
    const fields = new Set<string>(pmPlansSpec.fields.map((field) => field.name));
    const hidden = pmPlansSpec.hidden ?? {};
    const readOnly = pmPlansSpec.readOnly ?? {};
    const keys = Object.keys(pmPlanReplySchema.shape);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (STRUCTURAL.has(key)) continue;
      expect(
        fields.has(key) || key in hidden || key in readOnly,
        `pm-plans.${key} is neither field, hidden nor read-only`,
      ).toBe(true);
      if (key in hidden) expect(hidden[key]!.trim(), `pm-plans.${key} has no reason`).not.toBe('');
      if (key in readOnly)
        expect(readOnly[key]!.trim(), `pm-plans.${key} has no reason`).not.toBe('');
    }
  });

  it('states the clock anchor as read-only and the checklist as hidden', () => {
    expect(pmPlansSpec.readOnly?.createdAt).toContain('clock anchor');
    expect(pmPlansSpec.hidden?.checklist).toBeDefined();
    expect(pmPlansSpec.fields.find((field) => field.name === 'lastDoneOn')?.kind).toBe('date');
  });

  it('computes the next due from the anchor in the plant’s own zone', () => {
    const plan = {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'VC-1 preventive maintenance',
      machineId: '00000000-0000-0000-0000-000000000002',
      category: null,
      intervalDays: 182,
      meterInterval: null,
      meterTolerance: null,
      lastMeterReading: null,
      lastDoneOn: null,
      checklist: [],
      active: true,
      // 18:30 UTC on 10 November is already 11 November in Asia/Kolkata.
      createdAt: '2026-11-10T18:30:00.000Z',
    } satisfies PmPlanReply;
    expect(pmPlanNextDue(plan, 'Asia/Kolkata')).toBe('2027-05-12');
    expect(pmPlanNextDue(plan, 'UTC')).toBe('2027-05-11');
    expect(pmPlanNextDue({ ...plan, lastDoneOn: '2026-10-19' }, 'Asia/Kolkata')).toBe('2027-04-19');
    expect(pmPlanNextDue({ ...plan, intervalDays: null }, 'Asia/Kolkata')).toBeNull();
  });
});
