import { canClose } from '../../permissions.js';
import { asksSignoff } from '../../signoff.js';
import { apply, assertWorking, clampAt, closeSegments, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function close(
  input: TransitionInput,
  command: Extract<Command, { type: 'close' }>,
): TransitionResult {
  assertWorking(input);
  if (
    !canClose(
      {
        role: input.ctx.role,
        loginId: input.ctx.loginId,
        personId: input.ctx.personId,
        shared: input.ctx.shared,
      },
      {
        raisedLoginId: input.ticket.raisedLoginId,
        leadPersonId: input.ticket.leadPersonId,
        startedAt: input.ticket.startedAt,
        status: input.ticket.status,
        crew: input.crew,
      },
    )
  ) {
    throw new TransitionError('Not allowed to close');
  }
  const at = clampAt(command.at ?? input.ctx.now, input);
  const ticket = {
    status: 'closed' as const,
    closedAt: at,
    closedByPersonId: command.personId,
    closeKind: command.kind,
    closeNote: command.note ?? null,
  };
  return apply(input, {
    ticket,
    event: {
      type: 'close',
      reason: command.note,
      handbackRequested: asksSignoff(input.ticket, command.kind),
    },
    at,
    segments: closeSegments(input.segments, at),
  });
}
