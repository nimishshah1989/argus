import { apply, clampAt, TransitionError } from '../helpers.js';
import { assertSignoffOpen } from '../handback.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/**
 * Production says it is not fixed. The same ticket goes back to working for the last lead from now, the close is
 * undone, and a machine that had been marked running is stopped again.
 */
export function handbackDispute(
  input: TransitionInput,
  command: Extract<Command, { type: 'handbackDispute' }>,
): TransitionResult {
  assertSignoffOpen(input, command);
  const reason = command.reason.trim();
  if (!reason) throw new TransitionError('Invalid dispute: a reason is required');
  const lead = input.ticket.leadPersonId ?? input.ticket.closedByPersonId;
  if (!lead) throw new TransitionError('There is nobody to reopen the ticket for');
  const at = clampAt(input.ctx.now, input);
  const stopsAgain = input.ticket.machineRunningAt && !input.ticket.machineStoppedAt;
  return apply(input, {
    ticket: {
      status: 'working',
      leadPersonId: lead,
      segmentStartedAt: at,
      closedAt: null,
      closedByPersonId: null,
      closeKind: null,
      closeNote: null,
      ...(stopsAgain ? { machineStoppedAt: at } : {}),
    },
    event: { type: 'handback_dispute', reason },
    at,
    segments: [...input.segments, { personId: lead, role: 'lead', startedAt: at }],
  });
}
