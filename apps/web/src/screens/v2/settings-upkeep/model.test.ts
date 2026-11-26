// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { duty, plan, register, rule, shift } from './fixture-rows.js';
import { ladderSteps, pmTakeaway, registerTakeaway, rosterGaps } from './model.js';

const today = '2026-11-25';

describe('S26-3 PM plans, registers, roster, ladder model', () => {
  it('counts overdue PM plans, the latest one and the next one due', () => {
    const plans = [
      plan('late', '2026-11-07', 10), // due 17-Nov: 8 days late
      plan('soon', '2026-11-20', 7), // due 27-Nov
      plan('later', '2026-11-24', 30), // due 24-Dec
    ];
    expect(pmTakeaway(plans, today)).toEqual({
      total: 3,
      overdue: 1,
      worst: { planId: 'late', daysLate: 8 },
      next: { planId: 'soon', dueOn: '2026-11-27' },
    });
  });

  it('names the register row ending soonest, and the one after it', () => {
    const rows = [
      register('amc', { kind: 'amc', dueOn: '2026-12-20' }),
      register('war', { machineId: 'tc-56', endsOn: '2026-12-01' }),
      register('cal', { kind: 'calibration', dueOn: '2026-12-10', endsOn: '2026-11-26' }),
    ];
    expect(registerTakeaway(rows, today)).toEqual({
      soonest: { id: 'war', kind: 'warranty', machineId: 'tc-56', on: '2026-12-01', days: 6 },
      next: { id: 'cal', kind: 'calibration', machineId: null, on: '2026-12-10', days: 15 },
    });
  });

  it('finds the day and shift with no first call', () => {
    const shifts = [shift('A'), shift('B')];
    const entries = [duty('2026-11-25', 'A'), duty('2026-11-25', 'B'), duty('2026-11-26', 'A')];
    expect(rosterGaps(entries, shifts, '2026-11-25', 2)).toEqual({
      gaps: [{ date: '2026-11-26', shiftId: 'B' }],
      covered: 3,
      slots: 4,
    });
  });

  it('lists the rungs an unanswered High ticket climbs, by delay', () => {
    const rules = [
      rule({ level: 'L3', delayMinutes: 45 }),
      rule({ level: 'L2', delayMinutes: 15 }),
    ];
    expect(ladderSteps(rules)).toEqual([
      { level: 'L2', delayMinutes: 15 },
      { level: 'L3', delayMinutes: 45 },
    ]);
  });
});
