import { canWork } from '../../permissions.js';
import { standingLockoutConfirmations } from '../../lockout.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/**
 * The history entry that says who confirmed the lockout steps, and when. It is taken before Start, before a
 * resume or a join, and by anyone already on a working ticket who has none standing; the ticket itself does not change.
 */
export function confirmLockout(
  input: TransitionInput,
  command: Extract<Command, { type: 'confirmLockout' }>,
): TransitionResult {
  if (!['open', 'working', 'waiting'].includes(input.ticket.status)) {
    throw new TransitionError('Lockout is confirmed on a ticket that is still open');
  }
  const { role, loginId, personId, shared } = input.ctx;
  if (!canWork({ role, loginId, personId, shared })) throw new TransitionError('Not allowed');
  if (standingLockoutConfirmations(input.events).has(command.personId)) {
    throw new TransitionError('Lockout is already confirmed');
  }
  return apply(input, {
    ticket: {},
    event: { type: 'lockout_confirmed', reason: command.steps.join('; ') },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}
