import { mayAcknowledgeLevel, type EscalationLevel } from '../../escalation.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/**
 * Someone told by an escalation says "I have it" (DOMAIN section 3): the repeats of every escalation at or below the
 * level their role covers stop. The ticket itself does not move. `pendingLevels` is the caller's read of the history.
 */
export function acknowledgeEscalation(
  input: TransitionInput,
  command: Extract<Command, { type: 'acknowledgeEscalation' }>,
): TransitionResult {
  const covered = command.pendingLevels.filter((level) =>
    mayAcknowledgeLevel(input.ctx.role, level),
  );
  if (covered.length === 0) {
    if (command.pendingLevels.length > 0) throw new TransitionError('Not allowed');
    throw new TransitionError('Nothing to acknowledge');
  }
  const level = covered.reduce<EscalationLevel>(
    (highest, next) => (rank(next) > rank(highest) ? next : highest),
    covered[0] as EscalationLevel,
  );
  return apply(input, {
    ticket: {},
    event: { type: 'escalation_ack', escalationLevel: level },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}

function rank(level: EscalationLevel): number {
  return level === 'vendor' ? 1 : Number(level.slice(1));
}
