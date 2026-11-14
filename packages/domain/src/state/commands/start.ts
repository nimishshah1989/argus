import type { WorkSegment } from '../../types.js';
import { canWork } from '../../permissions.js';
import { apply, TransitionError } from '../helpers.js';
import { clampFrom } from '../internal.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function start(
  input: TransitionInput,
  command: Extract<Command, { type: 'start' }>,
): TransitionResult {
  if (input.ticket.status !== 'open') throw new TransitionError('Can only start an open ticket');
  if (input.segments.some((segment) => segment.role === 'lead' && !segment.endedAt)) {
    throw new TransitionError('Ticket already has an open lead segment');
  }
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  ) {
    throw new TransitionError('Not allowed');
  }
  // back-dating stops at the report time, or at the transfer time when picking up (not at a later update)
  const floor = input.ticket.handedOver
    ? (input.ticket.handoverSince ?? input.ticket.reportedAt)
    : input.ticket.reportedAt;
  const at = clampFrom(command.at ?? input.ctx.now, floor, input);
  const ticket = {
    status: 'working' as const,
    startedAt: at,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    handedOver: false,
  };
  const event = { type: command.pickup ? ('pickup' as const) : ('start' as const) };
  const segment: WorkSegment = { personId: command.personId, role: 'lead', startedAt: at };
  return apply(input, { ticket, event, at, segments: [...input.segments, segment] });
}
