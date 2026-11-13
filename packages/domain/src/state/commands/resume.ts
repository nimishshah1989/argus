import type { WorkSegment } from '../../types.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function resume(
  input: TransitionInput,
  command: Extract<Command, { type: 'resume' }>,
): TransitionResult {
  if (input.ticket.status !== 'waiting')
    throw new TransitionError('Can only resume a waiting ticket');
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'working' as const,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    waitReason: null,
    waitSince: null,
  };
  const segment: WorkSegment = { personId: command.personId, role: 'lead', startedAt: at };
  return apply(input, {
    ticket,
    event: { type: 'resume' },
    at,
    segments: [...input.segments, segment],
  });
}
