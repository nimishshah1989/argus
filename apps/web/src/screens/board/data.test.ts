import { describe, expect, it } from 'vitest';
import type { Group, Machine, Segment, Ticket } from '../../api.js';
import { liveBoard } from './data.js';

const NOW = '2026-11-14T10:00:00.000Z';
const minutesAgo = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'm-1',
    code: 'VC-1',
    category: null,
    cell: null,
    segment_id: 's-1',
    group_id: null,
    criticality: null,
    ...overrides,
  };
}

function breakdown(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    ref: 'BD-1',
    kind: 'stopped',
    status: 'open',
    machineId: 'm-1',
    machineSnapshot: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    reportedAt: minutesAgo(30),
    figures: null,
    ...overrides,
  } as Ticket;
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
const config = (machines: Machine[], segments = [segment], groups = [group]) => ({
  machines,
  segments,
  groups,
});
const codes = (stops: { machine: Machine }[]) => stops.map((stop) => stop.machine.code);

describe('liveBoard', () => {
  it('puts each stopped machine in the column of its breakdown: not started, being repaired, waiting', () => {
    const machines = ['m-1', 'm-2', 'm-3'].map((id, i) => machine({ id, code: `VC-${i + 1}` }));
    const open = [
      breakdown({ id: 't-1', machineId: 'm-1', status: 'open' }),
      breakdown({ id: 't-2', machineId: 'm-2', status: 'working' }),
      breakdown({ id: 't-3', machineId: 'm-3', status: 'waiting' }),
    ];
    const board = liveBoard(config(machines), open, NOW);
    expect(codes(board.columns.notStarted)).toEqual(['VC-1']);
    expect(codes(board.columns.repairing)).toEqual(['VC-2']);
    expect(codes(board.columns.waiting)).toEqual(['VC-3']);
  });

  it('lists the oldest stop first, with its age in minutes', () => {
    const machines = [machine({ id: 'm-1', code: 'NEW' }), machine({ id: 'm-2', code: 'OLD' })];
    const open = [
      breakdown({ id: 't-1', machineId: 'm-1', reportedAt: minutesAgo(20) }),
      breakdown({ id: 't-2', machineId: 'm-2', reportedAt: minutesAgo(3 * 1440) }),
    ];
    const { notStarted } = liveBoard(config(machines), open, NOW).columns;
    expect(notStarted.map((stop) => [stop.machine.code, stop.ageMin])).toEqual([
      ['OLD', 3 * 1440],
      ['NEW', 20],
    ]);
  });

  it('counts running and stopped machines: a machine running again is not stopped', () => {
    const machines = ['m-1', 'm-2', 'm-3'].map((id, i) => machine({ id, code: `VC-${i + 1}` }));
    const open = [
      breakdown({ id: 't-1', machineId: 'm-1' }),
      breakdown({ id: 't-2', machineId: 'm-2', status: 'working', machineRunningAt: NOW }),
      breakdown({ id: 't-3', machineId: 'm-3', kind: 'support' }),
    ];
    const board = liveBoard(config(machines), open, NOW);
    expect(board).toMatchObject({ machines: 3, running: 2, stopped: 1 });
    expect(codes(board.columns.repairing)).toEqual([]);
  });

  it('finds the machine by its raise-time code when the ticket has no machine id', () => {
    const open = [breakdown({ machineId: null, machineSnapshot: { code: 'VC-1' } })];
    const board = liveBoard(config([machine()]), open, NOW);
    expect(codes(board.columns.notStarted)).toEqual(['VC-1']);
  });

  it('sorts open breakdowns by age: under 1 h, 1 to 4 h, 4 to 24 h, over 1 day', () => {
    const ages = [10, 90, 200, 300, 1500, 3000];
    const machines = ages.map((_, i) => machine({ id: `m-${i}`, code: `VC-${i}` }));
    const open = ages.map((age, i) =>
      breakdown({ id: `t-${i}`, machineId: `m-${i}`, reportedAt: minutesAgo(age) }),
    );
    expect(liveBoard(config(machines), open, NOW).ages).toEqual({
      underHour: 1,
      oneToFour: 2,
      fourToDay: 1,
      overDay: 2,
    });
  });

  it('leaves the machines of a hidden group and of a segment kept off the board out of tiles and counts', () => {
    const hidden: Group = { ...group, id: 'g-2', code: 'AUX', hidden: true };
    const offBoard: Segment = { ...segment, id: 's-2', code: 'UTIL', show_on_board: false };
    const machines = [
      machine({ id: 'm-1', group_id: 'g-1' }),
      machine({ id: 'm-2', code: 'AUX-1', group_id: 'g-2' }),
      machine({ id: 'm-3', code: 'COMP-1', segment_id: 's-2' }),
    ];
    const open = ['m-1', 'm-2', 'm-3'].map((id) => breakdown({ id: `t-${id}`, machineId: id }));
    const board = liveBoard(config(machines, [segment, offBoard], [group, hidden]), open, NOW);
    expect(codes(board.columns.notStarted)).toEqual(['VC-1']);
    expect(board).toMatchObject({ machines: 1, running: 0, stopped: 1 });
    expect(board.ages.underHour).toBe(1);
  });
});
