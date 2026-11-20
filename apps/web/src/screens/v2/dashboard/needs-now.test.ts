import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../../api.js';
import { clocksBreached, needsNow } from './needs-now.js';

/**
 * The Today strip's picking rules: a breached acknowledgement or restore clock, a paused breakdown, or a
 * pending task past its expected date. Every case below fails if its filter (or the oldest-first order) is
 * removed from `needsNow`.
 */

const NOW = '2026-11-17T12:00:00.000Z';

let n = 0;
function ticket(over: Partial<Ticket>): Ticket {
  n += 1;
  return {
    id: `t${n}`,
    ref: `BD-${n}`,
    kind: 'stopped',
    status: 'open',
    machineId: 'm1',
    reportedAt: '2026-11-17T08:00:00Z',
    machineRunningAt: null,
    machineStoppedAt: null,
    waitSince: null,
    handedOver: false,
    urgent: false,
    parentId: null,
    taskExpectedOn: null,
    figures: null,
    sla: null,
    ...over,
  } as unknown as Ticket;
}

/** The ticket's SLA projection with only the clock a case cares about breached. */
const sla = (clock: 'ack' | 'restore', breached: boolean) =>
  ({ [clock]: { breached } }) as unknown as Ticket['sla'];

describe('what needs a person now', () => {
  it('picks a ticket whose acknowledgement clock has run out', () => {
    const breached = ticket({ sla: sla('ack', true) });
    expect(needsNow([breached], NOW).map((t) => t.id)).toEqual([breached.id]);
  });

  it('picks a ticket whose restore target has run out', () => {
    const breached = ticket({ sla: sla('restore', true) });
    expect(needsNow([breached], NOW).map((t) => t.id)).toEqual([breached.id]);
  });

  it('picks a paused breakdown waiting on someone', () => {
    const waiting = ticket({ status: 'waiting', waitSince: '2026-11-17T09:00:00Z' });
    expect(needsNow([waiting], NOW).map((t) => t.id)).toEqual([waiting.id]);
  });

  it('picks a pending task past its expected date, not one still due today or later', () => {
    const overdue = ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-16' });
    const dueToday = ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-17' });
    const later = ticket({ kind: 'general', parentId: 'p', taskExpectedOn: '2026-11-20' });
    expect(needsNow([overdue, dueToday, later], NOW).map((t) => t.id)).toEqual([overdue.id]);
  });

  it('leaves ordinary unstarted work to the Open list', () => {
    const unstarted = ticket({ status: 'open' });
    expect(needsNow([unstarted], NOW)).toEqual([]);
    expect(clocksBreached([unstarted])).toBe(0);
  });

  it('picks a ticket both breached and paused once, not twice', () => {
    const both = ticket({
      status: 'waiting',
      waitSince: '2026-11-17T09:00:00Z',
      sla: sla('ack', true),
    });
    expect(needsNow([both], NOW).map((t) => t.id)).toEqual([both.id]);
    expect(needsNow([both], NOW)).toHaveLength(1);
  });

  it('orders the picked tickets oldest first', () => {
    const middle = ticket({ reportedAt: '2026-11-17T09:00:00Z', sla: sla('ack', true) });
    const oldest = ticket({ status: 'waiting', reportedAt: '2026-11-15T09:00:00Z' });
    const newest = ticket({
      kind: 'general',
      parentId: 'p',
      taskExpectedOn: '2026-11-16',
      reportedAt: '2026-11-17T11:00:00Z',
    });
    expect(needsNow([middle, newest, oldest], NOW).map((t) => t.id)).toEqual([
      oldest.id,
      middle.id,
      newest.id,
    ]);
  });

  it('counts a breached clock once per ticket, whatever the clock', () => {
    const ack = ticket({ sla: sla('ack', true) });
    const restore = ticket({ sla: sla('restore', true) });
    const both = ticket({
      sla: { ack: { breached: true }, restore: { breached: true } } as unknown as Ticket['sla'],
    });
    expect(clocksBreached([ack, restore, both])).toBe(3);
  });
});
