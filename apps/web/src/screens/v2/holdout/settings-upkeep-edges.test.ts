// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { duty, plan, register, rule, shift } from '../settings-upkeep/fixture.js';
import { ladderSteps, pmTakeaway, registerTakeaway, rosterGaps } from '../settings-upkeep/model.js';

const today = '2026-11-25';

describe('S26-3 upkeep: edges', () => {
  it('is null or empty on empty lists', () => {
    expect(pmTakeaway([], today)).toBeNull();
    expect(registerTakeaway([], today)).toBeNull();
    expect(ladderSteps([])).toEqual([]);
    expect(rosterGaps([], [], today)).toEqual({ gaps: [], covered: 0, slots: 0 });
  });

  it('leaves out inactive rows and plans with no due date; due today is not overdue', () => {
    const plans = [
      plan('off', '2026-01-01', 10, false),
      plan('meter', null, null),
      plan('today', '2026-11-18', 7),
    ];
    expect(pmTakeaway(plans, today)).toEqual({
      total: 1,
      overdue: 0,
      worst: null,
      next: { planId: 'today', dueOn: '2026-11-25' },
    });
    expect(
      registerTakeaway([register('x', { endsOn: '2026-12-01', active: false })], today),
    ).toBeNull();
  });

  it('reports a register date already past as negative days', () => {
    const r = registerTakeaway([register('gone', { endsOn: '2026-11-20' })], today);
    expect(r).toEqual({
      soonest: { id: 'gone', kind: 'warranty', machineId: null, on: '2026-11-20', days: -5 },
      next: null,
    });
  });

  it('counts only active L1 entries on active shifts, over 7 days by default', () => {
    const shifts = [shift('A'), shift('off', false)];
    const entries = [
      duty('2026-11-25', 'A', 'L2'),
      duty('2026-11-26', 'A', 'L1', false),
      duty('2026-11-27', 'A'),
    ];
    const r = rosterGaps(entries, shifts, today);
    expect(r.slots).toBe(7);
    expect(r.covered).toBe(1);
    expect(r.gaps.map((g) => g.date)).toEqual([
      '2026-11-25',
      '2026-11-26',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
    ]);
  });

  it('keeps one rung per level at its earliest delay, ack_missed and active only', () => {
    const rules = [
      rule({ level: 'L2', delayMinutes: 30 }),
      rule({ level: 'L2', delayMinutes: 15, severityMin: 'S1' }),
      rule({ level: 'L3', delayMinutes: 5, trigger: 'restore_missed' }),
      rule({ level: 'L4', delayMinutes: 10, active: false }),
    ];
    expect(ladderSteps(rules)).toEqual([{ level: 'L2', delayMinutes: 15 }]);
  });
});
