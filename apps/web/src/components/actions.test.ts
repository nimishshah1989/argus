import { describe, expect, it } from 'vitest';
import type { Ticket } from '../api.js';
import { buildCorrectChanges, canCancelOwn, hasCorrectChanges, legalActions } from './actions.js';

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    ref: 'BD-0149',
    kind: 'stopped',
    status: 'open',
    machineId: 'machine-1',
    machineSnapshot: { code: 'VC-17', category: 'VMC', cell: 'Cell A' },
    problem: 'Spindle alarm',
    reportedAt: '2026-11-11T09:00:00.000Z',
    reportedByPersonId: 'person-1',
    location: null,
    workType: null,
    urgent: false,
    handedOver: false,
    startedAt: null,
    leadPersonId: null,
    waitReason: null,
    machineRunningAt: null,
    closedAt: null,
    closeKind: null,
    closeNote: null,
    severity: null,
    criticalitySnapshot: null,
    slaPolicyId: null,
    figures: null,
    ...overrides,
  };
}

function actions(t: Ticket, context?: { personId?: string | null; crew?: string[] }) {
  return legalActions(t, context).map((spec) => spec.action);
}

describe('legalActions join and leave', () => {
  it('offers join to a technician who is not on the crew', () => {
    const list = actions(ticket(), { personId: 'person-2', crew: [] });
    expect(list).toContain('join');
    expect(list).not.toContain('leave');
    expect(actions(ticket(), { personId: 'person-2', crew: [] })).toContain('start');
  });

  it('offers leave to an active crew member instead of join', () => {
    const list = actions(ticket(), { personId: 'person-2', crew: ['person-2'] });
    expect(list).toContain('leave');
    expect(list).not.toContain('join');
  });

  it('treats the lead as being on the crew', () => {
    const list = actions(ticket({ leadPersonId: 'person-2' }), {
      personId: 'person-2',
      crew: [],
    });
    expect(list).toContain('leave');
    expect(list).not.toContain('join');
  });

  it('offers join/leave on working and waiting tickets too', () => {
    const working = ticket({ status: 'working', startedAt: '2026-11-11T09:05:00.000Z' });
    expect(actions(working, { personId: 'person-2', crew: [] })).toContain('join');
    expect(actions(working, { personId: 'person-2', crew: ['person-2'] })).toContain('leave');
    const waiting = ticket({ status: 'waiting' });
    expect(actions(waiting, { personId: 'person-2', crew: ['person-2'] })).toContain('leave');
  });

  it('omits join/leave without an acting person or outside the live statuses', () => {
    expect(actions(ticket())).not.toContain('join');
    expect(actions(ticket())).not.toContain('leave');
    expect(actions(ticket({ status: 'closed' }), { personId: 'person-2' })).toEqual([]);
    expect(actions(ticket({ status: 'cancelled' }), { personId: 'person-2' })).toEqual([]);
  });
});

describe('legalActions cancel', () => {
  it('offers cancel from working (technician and above can cancel)', () => {
    const working = ticket({ status: 'working', startedAt: '2026-11-11T09:05:00.000Z' });
    expect(actions(working, { personId: 'person-1', crew: ['person-1'] })).toContain('cancel');
  });

  it('keeps cancel on open and waiting', () => {
    expect(actions(ticket())).toContain('cancel');
    expect(actions(ticket({ status: 'waiting' }), { personId: 'person-1' })).toContain('cancel');
  });
});

describe('canCancelOwn', () => {
  it('allows the reporter while the ticket is open and unstarted', () => {
    expect(canCancelOwn(ticket(), 'person-1')).toBe(true);
  });

  it('refuses once the ticket has started', () => {
    expect(canCancelOwn(ticket({ startedAt: '2026-11-11T09:05:00.000Z' }), 'person-1')).toBe(false);
  });

  it('refuses when it is not open', () => {
    expect(canCancelOwn(ticket({ status: 'working' }), 'person-1')).toBe(false);
    expect(canCancelOwn(ticket({ status: 'closed' }), 'person-1')).toBe(false);
  });

  it('refuses for someone else or no acting person', () => {
    expect(canCancelOwn(ticket(), 'person-2')).toBe(false);
    expect(canCancelOwn(ticket(), null)).toBe(false);
    expect(canCancelOwn(ticket({ reportedByPersonId: null }), 'person-1')).toBe(false);
  });
});

describe('buildCorrectChanges', () => {
  it('keeps only the fields the admin filled, trimmed', () => {
    expect(
      buildCorrectChanges({ problem: '  New problem  ', reportedAt: '2026-11-11T10:00' }),
    ).toEqual({ problem: 'New problem', reportedAt: '2026-11-11T10:00' });
  });

  it('treats empty and whitespace values as unchanged', () => {
    expect(buildCorrectChanges({ problem: '   ', reportedAt: '' })).toEqual({});
    expect(hasCorrectChanges({})).toBe(false);
  });

  it('keeps a machine and a known kind', () => {
    expect(buildCorrectChanges({ machineId: 'machine-1', kind: 'support' })).toEqual({
      machineId: 'machine-1',
      kind: 'support',
    });
  });

  it('ignores an unknown kind', () => {
    expect(buildCorrectChanges({ kind: 'bogus' })).toEqual({});
  });
});
