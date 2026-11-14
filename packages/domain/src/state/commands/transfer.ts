import { apply, assertWorking, clampAt, closeSegments } from '../helpers.js';
import { activeCrew } from '../internal.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function transfer(
  input: TransitionInput,
  command: Extract<Command, { type: 'transfer' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'open' as const,
    handedOver: true,
    handoverSince: at,
    transferToPersonId: command.toPersonId ?? null,
    transferToShift: command.toShift ?? null,
    transfers: input.ticket.transfers + 1,
    leadPersonId: null,
    segmentStartedAt: null,
  };
  return apply(input, {
    ticket,
    event: { type: 'transfer', reason: command.note },
    at,
    segments: closeSegments(input.segments, at),
    // his app stops the crew with the job: they are off it until someone joins again
    crew: input.crew.map((member) =>
      activeCrew(input).includes(member)
        ? { ...member, leftAt: at, leftReason: 'job transferred' }
        : member,
    ),
  });
}
