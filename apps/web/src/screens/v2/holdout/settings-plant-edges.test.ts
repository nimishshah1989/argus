// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { group, machine, shift } from '../settings-plant/fixture-rows.js';
import {
  groupsTakeaway,
  machinesTakeaway,
  shiftHours,
  shiftsTakeaway,
} from '../settings-plant/model.js';

describe('S26-2 machines, groups, shifts: edges', () => {
  it('is null on empty lists', () => {
    expect(machinesTakeaway([])).toBeNull();
    expect(groupsTakeaway([group('g')], [])).toBeNull();
    expect(shiftsTakeaway([], 16)).toBeNull();
  });

  it('leaves inactive rows out of every count', () => {
    const rows = [machine('a', { criticality: null, active: false }), machine('b')];
    expect(machinesTakeaway(rows)).toEqual({ total: 1, unset: 0, excluded: 0 });
    expect(
      groupsTakeaway([group('g', { active: false })], [machine('m', { groupId: 'g' })]),
    ).toBeNull();
    const shifts = [shift('A', '06:00', '14:00'), shift('X', '14:00', '22:00', false)];
    expect(shiftsTakeaway(shifts, null)).toEqual({
      count: 1,
      totalHours: 8,
      productionHours: null,
    });
  });

  it('on a tie the group listed first wins', () => {
    const machines = [machine('a', { groupId: 'two' }), machine('b', { groupId: 'one' })];
    expect(groupsTakeaway([group('one'), group('two')], machines)?.groupId).toBe('one');
  });

  it('counts half hours', () => {
    expect(shiftHours('23:30', '06:00')).toBe(6.5);
  });
});
