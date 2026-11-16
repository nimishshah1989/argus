import { canAnswerHandbackAtAll } from '@uptimo/domain';
import type { Ticket } from '../api.js';
import { ApiError } from '../data/index.js';
import { formatMinutes } from './format.js';

export type Handback = NonNullable<Ticket['handback']>;
export type SignoffState = 'asking' | 'confirmed' | 'reopened' | 'timedOut';

const STATE: Record<Handback['status'], SignoffState> = {
  requested: 'asking',
  confirmed: 'confirmed',
  disputed: 'reopened',
  timed_out: 'timedOut',
};

export const signoffState = (handback: Handback): SignoffState => STATE[handback.status];

/** Whether this login is ever asked "Is it fixed?"; technicians and the board never answer one. */
export const canAskHandback = canAnswerHandbackAtAll;

const minutesBetween = (from: string, to: string): number =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

/** The plant's wait limit (the sign-off timeout); null when the plant sets none. */
export const signoffLimitMin = (handback: Handback): number | null =>
  handback.dueAt ? minutesBetween(handback.requestedAt, handback.dueAt) : null;

/** How long production has been asked so far. */
export const waitedMin = (handback: Handback, nowIso: string): number =>
  minutesBetween(handback.requestedAt, nowIso);

/** What went wrong when production's answer was refused, in words the screen can pick a message for. */
export type Refusal =
  | { kind: 'newBreakdown'; ref: string | null; reportedAt: string | null }
  | { kind: 'otherCell' }
  | { kind: 'notAllowed' }
  | { kind: 'other' };

/**
 * The one place that reads the server's refusals. The stable codes decide, never the message text: a wording edit
 * must not turn a known refusal into "Could not send. Try again." A plain conflict or 403 stays the generic refusal.
 */
export function signoffRefusal(error: unknown, response: 'confirmed' | 'disputed'): Refusal {
  if (!(error instanceof ApiError)) return { kind: 'other' };
  if (error.code === 'other_cell') return { kind: 'otherCell' };
  // A 403 is also a switched phone person or a wrong role, so it must not claim "other cell" without the code.
  if (error.code === 'forbidden') return { kind: 'notAllowed' };
  if (response === 'disputed' && error.code === 'reopen_blocked')
    return {
      kind: 'newBreakdown',
      ref: error.openTicket?.ref ?? null,
      reportedAt: error.openTicket?.reportedAt ?? null,
    };
  return { kind: 'other' };
}

/** The wait limit as the mockups write it: "4 h", not "4 h 0 min". */
export function formatLimit(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0 && minutes < 1440
    ? `${minutes / 60} h`
    : formatMinutes(minutes);
}
