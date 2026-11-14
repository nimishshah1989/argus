import { canAcknowledge } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/** The rostered person says "I have seen it". Stops the acknowledge clock; the ticket itself does not move. */
export function acknowledge(
  input: TransitionInput,
  command: Extract<Command, { type: 'acknowledge' }>,
): TransitionResult {
  // the permission answer is the same on every ticket, so it comes before any state check
  if (!canAcknowledge(input.ctx, command.onRoster)) throw new TransitionError('Not allowed');
  if (!['open', 'working'].includes(input.ticket.status))
    throw new TransitionError(`Ticket is ${input.ticket.status}: nothing to acknowledge`);
  if (input.events.some((event) => event.type === 'acknowledge'))
    throw new TransitionError('Ticket is already acknowledged');
  return apply(input, {
    ticket: {},
    event: { type: 'acknowledge' },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}
