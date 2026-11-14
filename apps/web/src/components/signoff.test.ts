import { describe, expect, it } from 'vitest';
import { ApiError } from '../data/index.js';
import {
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
  const conflict = new ApiError(
    'conflict',
    'The sign-off cannot reopen this ticket: the machine already has an open ticket, BD-0171.',
  );

  it('tells a dispute against a machine with a new open breakdown from other conflicts', () => {
    expect(signoffRefusal(conflict, 'disputed')).toEqual({ kind: 'newBreakdown', ref: null });
    expect(signoffRefusal(new ApiError('conflict', 'Already answered'), 'disputed')).toEqual({
      kind: 'other',
    });
    expect(signoffRefusal(conflict, 'confirmed')).toEqual({ kind: 'other' });
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
