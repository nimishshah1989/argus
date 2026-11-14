import type { RestorableStatus } from '../../types.js';
import { canCancel } from '../../permissions.js';
import { apply, clampAt, closeSegments, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function cancel(
  input: TransitionInput,
  command: Extract<Command, { type: 'cancel' }>,
): TransitionResult {
  // no state tells these roles anything: the answer is the same on every ticket
  if (input.ctx.role === 'plant_head' || input.ctx.role === 'board')
    throw new TransitionError('Not allowed to cancel');
  // a ticket already closed or cancelled is a conflict for everyone else, not a permission question
  if (!['open', 'working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError(`Ticket is already ${input.ticket.status}`);
  const actor = {
    role: input.ctx.role,
    loginId: input.ctx.loginId,
    personId: input.ctx.personId,
    shared: input.ctx.shared,
  };
  if (
    !canCancel(actor, {
      raisedLoginId: input.ticket.raisedLoginId,
      leadPersonId: input.ticket.leadPersonId,
      startedAt: input.ticket.startedAt,
      status: input.ticket.status,
      crew: input.crew,
    })
  ) {
    throw new TransitionError('Not allowed to cancel');
  }
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { status: 'cancelled' as const, cancelledAt: at },
    event: {
      type: 'cancel',
      reason: command.reason,
      status: input.ticket.status as RestorableStatus,
    },
    at,
    segments: closeSegments(input.segments, at),
  });
}
