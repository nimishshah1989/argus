import { canWork } from '../../permissions.js';
import { standingLockoutConfirmation } from '../../lockout.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/** The history entry that says who confirmed the lockout steps, and when; the ticket itself does not change. */
export function confirmLockout(
  input: TransitionInput,
  command: Extract<Command, { type: 'confirmLockout' }>,
): TransitionResult {
  if (input.ticket.status !== 'open') {
    throw new TransitionError('Lockout is confirmed before work starts');
  }
  const { role, loginId, personId, shared } = input.ctx;
  if (!canWork({ role, loginId, personId, shared })) throw new TransitionError('Not allowed');
  if (standingLockoutConfirmation(input.events)) {
    throw new TransitionError('Lockout is already confirmed');
  }
  return apply(input, {
    ticket: {},
    event: { type: 'lockout_confirmed', reason: command.steps.join('; ') },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}
