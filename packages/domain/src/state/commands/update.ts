import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function update(
  input: TransitionInput,
  command: Extract<Command, { type: 'update' }>,
): TransitionResult {
  if (!['open', 'working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Cannot update a closed ticket');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: {},
    event: { type: 'update', reason: command.text },
    at,
    segments: input.segments,
  });
}
