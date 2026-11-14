import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function upgradeKind(
  input: TransitionInput,
  _command: Extract<Command, { type: 'upgradeKind' }>,
): TransitionResult {
  if (input.ticket.kind !== 'support')
    throw new TransitionError('Only a support ticket can be upgraded');
  // A closed or cancelled ticket is history: upgrading it would change what the record says happened.
  if (!['open', 'working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Only a ticket that is still open can be upgraded');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { kind: 'stopped', kindUpgradedAt: at },
    event: { type: 'upgrade_kind' },
    at,
    segments: input.segments,
  });
}
