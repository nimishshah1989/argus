import { acknowledgeRefusal } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/** The assignee or the person on the roster says "I have seen it". Stops the acknowledge clock; the ticket itself does not move. */
export function acknowledge(
  input: TransitionInput,
  command: Extract<Command, { type: 'acknowledge' }>,
): TransitionResult {
  const refusal = acknowledgeRefusal(input.ctx, input.ticket, {
    onRoster: command.onRoster,
    alreadyAcknowledged: input.events.some((e) => e.type === 'acknowledge'),
  });
  if (refusal) throw new TransitionError(refusal);
  return apply(input, {
    ticket: {},
    event: { type: 'acknowledge' },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}
