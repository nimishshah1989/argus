import { apply, assertWorking, clampAt, closeSegments } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function pause(
  input: TransitionInput,
  command: Extract<Command, { type: 'pause' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'waiting' as const,
    waitReason: command.reason,
    waitSince: at,
    assignedToPersonId: command.assignToPersonId ?? input.ticket.assignedToPersonId,
  };
  return apply(input, {
    ticket,
    event: { type: 'pause', reason: command.reason },
    at,
    segments: closeSegments(input.segments, at),
  });
}
