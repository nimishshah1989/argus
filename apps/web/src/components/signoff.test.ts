import { describe, expect, it } from 'vitest';
import { ApiError } from '../data/index.js';
import {
  canAskHandback,
  formatLimit,
  signoffLimitMin,
  signoffRefusal,
  signoffState,
  waitedMin,
  type Handback,
} from './signoff.js';

const handback = (over: Partial<Handback> = {}): Handback => ({
  status: 'requested',
  requestedAt: '2026-11-13T10:31:00.000Z',
  dueAt: '2026-11-13T14:31:00.000Z',
  respondedAt: null,
  respondedByPersonId: null,
  disputeReason: null,
  reopenCount: 0,
  turnaround: { maintenanceMin: 261, productionMin: 0 },
  ...over,
});

describe('who is asked', () => {
  it('asks only a login that may answer a sign-off', () => {
    expect(canAskHandback('operator')).toBe(true);
    for (const role of ['supervisor', 'head', 'plant_head', 'admin'])
      expect(canAskHandback(role)).toBe(true);
    expect(canAskHandback('technician')).toBe(false);
    expect(canAskHandback('board')).toBe(false);
  });
});

describe('sign-off states', () => {
  it('names what production is shown for each server status', () => {
    expect(signoffState(handback())).toBe('asking');
    expect(signoffState(handback({ status: 'confirmed' }))).toBe('confirmed');
    expect(signoffState(handback({ status: 'disputed' }))).toBe('reopened');
    expect(signoffState(handback({ status: 'timed_out' }))).toBe('timedOut');
  });

  it('reads the 4 h limit and the wait so far from the dates', () => {
    expect(signoffLimitMin(handback())).toBe(240);
    expect(signoffLimitMin(handback({ dueAt: null }))).toBeNull();
    expect(waitedMin(handback(), '2026-11-13T11:09:00.000Z')).toBe(38);
  });
});

describe('wait limit words', () => {
  it('writes whole hours without minutes', () => {
    expect(formatLimit(240)).toBe('4 h');
    expect(formatLimit(90)).toBe('1 h 30 min');
    expect(formatLimit(30)).toBe('30 min');
  });
});

describe('sign-off refusals', () => {
  const blocked = new ApiError(
    'reopen_blocked',
    'The sign-off cannot reopen this ticket: the machine already has an open ticket, BD-0171.',
    undefined,
    409,
    {
      openTicket: {
        ticketId: 'ticket-171',
        ref: 'BD-0171',
        reportedAt: '2026-11-13T10:50:00.000Z',
      },
    },
  );

  it('reads the new breakdown from the code and its open ticket', () => {
    expect(signoffRefusal(blocked, 'disputed')).toMatchObject({
      kind: 'newBreakdown',
      ref: 'BD-0171',
      reportedAt: '2026-11-13T10:50:00.000Z',
    });
    expect(signoffRefusal(new ApiError('conflict', 'Already answered'), 'disputed')).toEqual({
      kind: 'other',
    });
    expect(signoffRefusal(blocked, 'confirmed')).toEqual({ kind: 'other' });
  });

  it('never decides from the server words, so a wording edit cannot hide the refusal', () => {
    const renamed = new ApiError('reopen_blocked', 'The office printer is on fire');
    expect(signoffRefusal(renamed, 'disputed')).toEqual({
      kind: 'newBreakdown',
      ref: null,
      reportedAt: null,
    });
    const oldWording = new ApiError(
      'conflict',
      'The sign-off cannot reopen this ticket: the machine already has an open ticket, BD-0171.',
    );
    expect(signoffRefusal(oldWording, 'disputed')).toEqual({ kind: 'other' });
  });

  it('reads another cell from its code, not from every 403', () => {
    expect(signoffRefusal(new ApiError('other_cell', 'no'), 'confirmed')).toEqual({
      kind: 'otherCell',
    });
  });

  it('does not blame the cell for a plain 403, which is also a switched person or a wrong role', () => {
    expect(signoffRefusal(new ApiError('forbidden', 'no'), 'confirmed')).toEqual({
      kind: 'notAllowed',
    });
  });

  it('treats a lost connection as a plain failure', () => {
    expect(signoffRefusal(new TypeError('Failed to fetch'), 'confirmed')).toEqual({
      kind: 'other',
    });
  });
});
