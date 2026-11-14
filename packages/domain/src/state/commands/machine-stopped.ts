import { apply, TransitionError } from '../helpers.js';
import { clampFrom } from '../internal.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function machineStopped(
  input: TransitionInput,
  command: Extract<Command, { type: 'machineStopped' }>,
): TransitionResult {
  const running = input.ticket.machineRunningAt;
  if (
    !running ||
    input.ticket.machineStoppedAt ||
    !['open', 'working', 'waiting'].includes(input.ticket.status)
  )
    throw new TransitionError('Machine is not running');
  const at = clampFrom(command.at ?? input.ctx.now, running, input);
  return apply(input, {
    ticket: { machineStoppedAt: at },
    event: { type: 'stopped' },
    at,
    segments: input.segments,
  });
}
