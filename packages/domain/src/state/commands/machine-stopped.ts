import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function machineStopped(
  input: TransitionInput,
  _command: Extract<Command, { type: 'machineStopped' }>,
): TransitionResult {
  if (!input.ticket.machineRunningAt) throw new TransitionError('Machine is not running');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { machineStoppedAt: at },
    event: { type: 'stopped' },
    at,
    segments: input.segments,
  });
}
