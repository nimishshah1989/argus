import { describe, expect, it } from 'vitest';
import type { Machine, Ticket } from '../../api.js';
import {
  breakdownCount,
  chipOf,
  downNow,
  notStarted,
  openCounts,
  pausedBreakdowns,
  pendingTasks,
  timeLine,
  typeLine,
  workRequests,
} from './openLists.js';

let n = 0;
function ticket(over: Partial<Ticket>): Ticket {
  n += 1;
  return {
    id: `t${n}`,
    ref: `BD-${n}`,
    kind: 'stopped',
    status: 'open',
    machineId: 'm1',
    reportedAt: '2026-11-13T08:00:00Z',
    machineRunningAt: null,
    machineStoppedAt: null,
    waitSince: null,
    handedOver: false,
    urgent: false,
    parentId: null,
    taskExpectedOn: null,
    figures: null,
    ...over,
  } as unknown as Ticket;
}
const machines = ['m1', 'm2', 'm3', 'm4'].map((id) => ({ id, code: id })) as unknown as Machine[];

describe('Open counts (v3.views.01)', () => {
  it('counts machines down, waiting, needing support, and the rest running OK', () => {
    const open = [
      ticket({ machineId: 'm1' }),
      ticket({ machineId: 'm2', status: 'waiting' }),
      ticket({ machineId: 'm3', kind: 'support' }),
      ticket({ kind: 'general', machineId: null }),
    ];
    expect(openCounts(open, machines)).toEqual({ down: 1, waiting: 1, support: 1, running: 1 });
  });

  it('counts a machine running again with its ticket still open as support, not down', () => {
    const follow = ticket({ machineRunningAt: '2026-11-13T09:00:00Z' });
    expect(chipOf(follow)).toBe('support');
  });
});

describe('Open lists (v3.views.01 sort rules)', () => {
  it('lists stopped before support, and the longest wait first', () => {
    const late = ticket({ reportedAt: '2026-11-13T09:00:00Z' });
    const early = ticket({ reportedAt: '2026-11-13T07:00:00Z' });
    const support = ticket({ kind: 'support', reportedAt: '2026-11-13T06:00:00Z' });
    expect(notStarted([late, support, early], '')).toEqual([early, late, support]);
  });

  it('narrows to the tapped chip, and Running OK shows everything', () => {
    const down = ticket({});
    const support = ticket({ kind: 'support' });
    expect(notStarted([down, support], 'support')).toEqual([support]);
    expect(notStarted([down, support], 'running')).toHaveLength(2);
  });

  it('puts the longest paused first', () => {
    const a = ticket({ status: 'waiting', waitSince: '2026-11-13T10:00:00Z' });
    const b = ticket({ status: 'waiting', waitSince: '2026-11-13T09:00:00Z' });
    expect(pausedBreakdowns([a, b], '')).toEqual([b, a]);
  });

  it('orders pending tasks by expected date, undated last', () => {
    const none = ticket({ kind: 'general', parentId: 'p', reportedAt: '2026-11-13T05:00:00Z' });
    const soon = ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-14' });
    const later = ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-20' });
    expect(pendingTasks([none, later, soon])).toEqual([soon, later, none]);
  });

  it('puts urgent work requests first and leaves tasks out of Work', () => {
    const old = ticket({ kind: 'general', reportedAt: '2026-11-13T05:00:00Z' });
    const urgent = ticket({ kind: 'general', urgent: true, reportedAt: '2026-11-13T09:00:00Z' });
    const task = ticket({ kind: 'general', parentId: 'p' });
    expect(workRequests([old, urgent, task])).toEqual([urgent, old]);
  });

  it('leaves a planned PM job out of the desk’s work requests (R10)', () => {
    const pm = ticket({ kind: 'general', raisedChannel: 'pm' } as Partial<Ticket>);
    const inspection = ticket({ kind: 'general', raisedChannel: 'inspection' } as Partial<Ticket>);
    const work = ticket({ kind: 'general' });
    expect(workRequests([pm, inspection, work])).toEqual([work]);
  });

  it('counts breakdowns that are open or paused, not working ones', () => {
    const open = [ticket({}), ticket({ status: 'waiting' }), ticket({ status: 'working' })];
    expect(breakdownCount(open)).toBe(2);
  });
});

describe('the minutes on a card', () => {
  const now = '2026-11-13T09:00:00Z';
  it('adds the finished stopped stretches to the one still open', () => {
    const t = ticket({ figures: { downAccMin: 10 } as Ticket['figures'] });
    expect(downNow(t, now)).toBe(70);
    const stoppedAgain = ticket({
      machineStoppedAt: '2026-11-13T08:30:00Z',
      figures: { downAccMin: 10 } as Ticket['figures'],
    });
    expect(downNow(stoppedAgain, now)).toBe(40);
  });

  it('stops counting while the machine runs', () => {
    const t = ticket({
      machineRunningAt: '2026-11-13T08:30:00Z',
      figures: { downAccMin: 30 } as Ticket['figures'],
    });
    expect(downNow(t, now)).toBe(30);
    expect(timeLine(t, now)).toMatchObject({ key: 'deskLists.time.follow', minutes: 30 });
  });

  it('says Waiting for an open breakdown nobody started and Open for work', () => {
    expect(timeLine(ticket({}), now).key).toBe('deskLists.time.waiting');
    expect(timeLine(ticket({ kind: 'general' }), now)).toMatchObject({
      key: 'deskLists.time.open',
      minutes: 60,
    });
  });
});

describe('the type line on a card (v3 typeLine)', () => {
  it('says what kind of job it is', () => {
    expect(typeLine(ticket({})).key).toBe('deskLists.type.stopped');
    expect(typeLine(ticket({ machineRunningAt: '2026-11-13T09:00:00Z' })).key).toBe(
      'deskLists.type.follow',
    );
    expect(typeLine(ticket({ kind: 'support' })).key).toBe('deskLists.type.support');
    expect(typeLine(ticket({ kind: 'general' })).key).toBe('deskLists.type.work');
  });

  it('names the expected date of a pending task', () => {
    const task = typeLine(ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-20' }));
    expect(task).toMatchObject({ key: 'deskLists.type.taskExpected', date: '2026-11-20' });
  });
});
