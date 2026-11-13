import { describe, expect, it } from 'vitest';
import type { Group, Machine, Segment } from '../../api.js';
import { buildSections } from './data.js';

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'm-1',
    code: 'VC-1',
    category: null,
    cell: null,
    segment_id: null,
    group_id: null,
    criticality: null,
    ...overrides,
  };
}

const segment: Segment = { id: 's-1', code: 'CNC', name: 'CNC' };
const group: Group = { id: 'g-1', segment_id: 's-1', code: 'VMC', name: 'Vertical' };

describe('buildSections', () => {
  it('labels a machine with no segment as other', () => {
    const sections = buildSections([machine()], [segment], [], []);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: 'other', label: null, other: true });
  });

  it('labels a machine in an unknown group as other, and keeps a configured group name', () => {
    const machines = [
      machine({ id: 'm-1', segment_id: 's-1', group_id: 'g-1' }),
      machine({ id: 'm-2', code: 'VC-2', segment_id: 's-1', group_id: 'g-gone' }),
    ];
    const [section] = buildSections(machines, [segment], [group], []);
    expect(section).toMatchObject({ label: 'CNC', other: false });
    expect(section?.groups).toEqual([
      expect.objectContaining({ id: 'g-1', label: 'Vertical', other: false }),
      expect.objectContaining({ id: 'other', label: null, other: true }),
    ]);
  });
});
