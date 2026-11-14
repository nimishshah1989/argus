import { describe, expect, it } from 'vitest';
import type { Group, Machine, Segment, Ticket } from '../../api.js';
import { boardCounts, buildSections, ticketsOnBoard } from './data.js';

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

const segment: Segment = {
  id: 's-1',
  code: 'CNC',
  name: 'CNC',
  sort: 0,
  show_on_board: true,
  group_by: 'letters',
};
const group: Group = {
  id: 'g-1',
  segment_id: 's-1',
  code: 'VMC',
  name: 'Vertical',
  sort: 0,
  hidden: false,
};

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

  it('leaves out the machines of a hidden group', () => {
    const hidden: Group = { ...group, id: 'g-2', code: 'AUX', name: 'Auxiliary', hidden: true };
    const machines = [
      machine({ id: 'm-1', segment_id: 's-1', group_id: 'g-1' }),
      machine({ id: 'm-2', code: 'AUX-1', segment_id: 's-1', group_id: 'g-2' }),
    ];
    const sections = buildSections(machines, [segment], [group, hidden], []);
    const codes = sections.flatMap((s) =>
      s.groups.flatMap((g) => g.tiles.map((t) => t.machine.code)),
    );
    expect(codes).toEqual(['VC-1']);
    expect(sections[0]?.groups.map((g) => g.label)).toEqual(['Vertical']);
  });

  it('leaves out a segment that is not shown on the board', () => {
    const offBoard: Segment = {
      ...segment,
      id: 's-2',
      code: 'UTIL',
      name: 'Utilities',
      show_on_board: false,
    };
    const machines = [
      machine({ id: 'm-1', segment_id: 's-1' }),
      machine({ id: 'm-2', code: 'COMP-1', segment_id: 's-2' }),
    ];
    const sections = buildSections(machines, [segment, offBoard], [], []);
    expect(sections.map((s) => s.label)).toEqual(['CNC']);
    expect(
      sections.flatMap((s) => s.groups.flatMap((g) => g.tiles.map((t) => t.machine.code))),
    ).toEqual(['VC-1']);
  });

  it('counts only the tickets on machines the board shows', () => {
    const hidden: Group = { ...group, id: 'g-2', hidden: true };
    const offBoard: Segment = { ...segment, id: 's-2', code: 'UTIL', show_on_board: false };
    const machines = [
      machine({ id: 'm-1', segment_id: 's-1', group_id: 'g-1' }),
      machine({ id: 'm-2', code: 'AUX-1', segment_id: 's-1', group_id: 'g-2' }),
      machine({ id: 'm-3', code: 'COMP-1', segment_id: 's-2' }),
    ];
    const stopped = (id: string, machineId: string | null) =>
      ({ id, kind: machineId ? 'stopped' : 'general', status: 'open', machineId }) as Ticket;
    const open = [
      stopped('t-1', 'm-1'),
      stopped('t-2', 'm-2'),
      stopped('t-3', 'm-3'),
      stopped('t-4', null),
    ];
    const config = { machines, segments: [segment, offBoard], groups: [group, hidden] };
    const counts = boardCounts(ticketsOnBoard(open, config));
    expect(counts).toMatchObject({ total: 2, stopped: 1, workRequests: 1 });
  });
});
