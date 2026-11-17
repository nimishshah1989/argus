import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../api.js';
import { waitingFirst } from './TeamPanel.js';

let n = 0;
function ticket(over: Partial<Ticket>): Ticket {
  n += 1;
  return {
    id: `t${n}`,
    ref: `BD-${n}`,
    kind: 'stopped',
    status: 'waiting',
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

describe('the Team tab Waiting list (M2-34 addendum 2)', () => {
  it('puts the longest wait first, whatever order the server sent', () => {
    const newer = ticket({ waitSince: '2026-11-13T10:00:00Z' });
    const oldest = ticket({ waitSince: '2026-11-13T07:00:00Z' });
    const older = ticket({ waitSince: '2026-11-13T09:00:00Z' });
    expect(waitingFirst([newer, oldest, older])).toEqual([oldest, older, newer]);
  });

  it('lists only paused tickets, leaving working and open ones out', () => {
    const paused = ticket({ waitSince: '2026-11-13T09:00:00Z' });
    const working = ticket({ status: 'working' });
    const open = ticket({ status: 'open' });
    expect(waitingFirst([working, paused, open])).toEqual([paused]);
  });
});
