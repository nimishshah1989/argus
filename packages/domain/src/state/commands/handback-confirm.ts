import { apply, clampAt } from '../helpers.js';
import { assertSignoffOpen } from '../handback.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/** Production says the machine is fixed. The ticket stays closed; the answer is on the log. */
export function handbackConfirm(
  input: TransitionInput,
  command: Extract<Command, { type: 'handbackConfirm' }>,
): TransitionResult {
  assertSignoffOpen(input, command);
  return apply(input, {
    ticket: {},
    event: { type: 'handback_confirm' },
    at: clampAt(input.ctx.now, input),
    segments: input.segments,
  });
}
