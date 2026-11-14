import { describe, expect, it } from 'vitest';
import type { Group, Machine, Segment, Ticket } from '../../api.js';
import {
  groupExample,
  groupMachines,
  machineByCode,
  searchMachines,
  sections,
} from './machines.js';

const machine = (code: string, group_id: string | null = 'g1'): Machine => ({
  id: code,
  code,
  category: null,
  cell: null,
  segment_id: 's1',
  group_id,
  criticality: null,
});
const group = (id: string, code: string, extra: Partial<Group> = {}): Group => ({
  id,
  segment_id: 's1',
  code,
  name: code,
  sort: 0,
  hidden: false,
  ...extra,
});
const segment: Segment = {
  id: 's1',
  code: 'CNC',
  name: 'CNC',
  sort: 0,
  show_on_board: true,
  group_by: '',
};
const codes = (list: Machine[]) => list.map((m) => m.code);

describe('floor machine search', () => {
  const all = ['VC-117', 'TC-17', 'VC-17', 'VC-170', 'TC-4'].map((c) => machine(c));

  it('ranks the exact code, then codes ending in it, then the rest, ignoring spaces and dashes', () => {
    expect(codes(searchMachines(all, 'vc 17'))).toEqual(['VC-17', 'VC-170']);
    expect(codes(searchMachines(all, '17'))).toEqual(['TC-17', 'VC-17', 'VC-117', 'VC-170']);
    expect(searchMachines(all, '  ')).toEqual([]);
  });

  it('finds a ?m= machine by the same normalisation', () => {
    expect(machineByCode(all, 'vc17')?.code).toBe('VC-17');
    expect(machineByCode(all, 'VC-99')).toBeUndefined();
  });

  it('inside a group the number alone finds the machine', () => {
    const vc = group('g1', 'VC');
    expect(codes(groupMachines(all, vc, '4'))).toEqual(['TC-4']);
    expect(codes(groupMachines(all, vc, '117'))).toEqual(['VC-117']);
    expect(groupExample(groupMachines(all, vc, ''), vc)).toEqual({ num: '17', code: 'VC-17' });
  });
});

describe('floor group sections', () => {
  it('counts machines per group and segment and drops hidden or empty groups', () => {
    const machines = [
      machine('VC-1'),
      machine('VC-2'),
      machine('TC-1', 'g2'),
      machine('X-1', 'g3'),
    ];
    const groups = [
      group('g1', 'VC'),
      group('g2', 'TC'),
      group('g3', 'X', { hidden: true }),
      group('g4', 'E'),
    ];
    const [cnc] = sections({ segments: [segment], groups, machines });
    expect(cnc?.count).toBe(3);
    expect(cnc?.groups.map((g) => [g.group.code, g.count])).toEqual([
      ['VC', 2],
      ['TC', 1],
    ]);
  });
});

describe('floor complaint words', () => {
  it('reads Booked, In progress, Fixed, and a cancelled ticket as Cancelled', async () => {
    const { floorStatus } = await import('./machines.js');
    const of = (status: Ticket['status']) => floorStatus({ status } as Ticket);
    expect([of('open'), of('working'), of('waiting'), of('closed')]).toEqual([
      { group: 'floor', id: 'booked' },
      { group: 'floor', id: 'in_progress' },
      { group: 'floor', id: 'in_progress' },
      { group: 'floor', id: 'fixed' },
    ]);
    expect(of('cancelled')).toEqual({ group: 'ticket', id: 'cancelled' });
  });
});
