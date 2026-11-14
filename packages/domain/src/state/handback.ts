import { canAnswerHandback } from '../permissions.js';
import { currentSignoff } from '../signoff.js';
import { TransitionError } from './helpers.js';
import type { Command, TransitionInput } from './types.js';

/** Both answers share these rules: who may answer, and that a sign-off is open (closed, asked, not yet answered). */
export function assertSignoffOpen(
  input: TransitionInput,
  command: Extract<Command, { type: 'handbackConfirm' | 'handbackDispute' }>,
): void {
  if (!canAnswerHandback(input.ctx, input.ticket, command.sameCell)) {
    throw new TransitionError('Not allowed to answer the sign-off');
  }
  const signoff = currentSignoff(input.events);
  if (input.ticket.status !== 'closed' || !signoff) {
    throw new TransitionError('Nothing to sign off on this ticket');
  }
  if (signoff.answer) throw new TransitionError('The sign-off is already answered');
}
