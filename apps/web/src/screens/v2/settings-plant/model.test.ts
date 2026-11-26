// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { group, machine, shift } from './fixture-rows.js';
import { groupsTakeaway, machinesTakeaway, shiftHours, shiftsTakeaway } from './model.js';

describe('S26-2 machines, groups, shifts model', () => {
  it('counts machines with no criticality and machines not counted in production data', () => {
    const rows = [
      machine('a', { criticality: null }),
      machine('b', { excludedFromProduction: true }),
      machine('c'),
    ];
    expect(machinesTakeaway(rows)).toEqual({ total: 3, unset: 1, excluded: 1 });
  });

  it('names the group with the most machines', () => {
    const groups = [group('turning'), group('milling', { hidden: true })];
    const machines = [
      machine('a', { groupId: 'milling' }),
      machine('b', { groupId: 'milling' }),
      machine('c', { groupId: 'turning' }),
      machine('d'),
    ];
    expect(groupsTakeaway(groups, machines)).toEqual({
      groupId: 'milling',
      n: 2,
      total: 4,
      hidden: true,
    });
  });

  it('adds shift hours, wrapping past midnight', () => {
    expect(shiftHours('06:00', '14:00')).toBe(8);
    expect(shiftHours('22:00', '06:00')).toBe(8);
    const shifts = [
      shift('A', '06:00', '14:00'),
      shift('B', '14:00', '22:00'),
      shift('C', '22:00', '06:00'),
    ];
    expect(shiftsTakeaway(shifts, 16)).toEqual({ count: 3, totalHours: 24, productionHours: 16 });
  });
});
