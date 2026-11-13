import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function machineRunning(
  input: TransitionInput,
  command: Extract<Command, { type: 'machineRunning' }>,
): TransitionResult {
  if (input.ticket.kind !== 'stopped')
    throw new TransitionError('Only a stopped ticket has a running machine');
  const at = clampAt(command.at ?? input.ctx.now, input);
  return apply(input, {
    ticket: { machineRunningAt: at, machineStoppedAt: null },
    event: { type: 'running' },
    at,
    segments: input.segments,
  });
}
