import { canClose } from '../../permissions.js';
import { asksSignoff } from '../../signoff.js';
import { apply, assertWorking, clampAt, closeSegments, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';
import { start } from './start.js';

type CloseCommand = Extract<Command, { type: 'close' }>;

/**
 * A follow-up task is finished in one step: left open, it is started by the person closing it, at the close time,
 * and then closed. Any other open ticket must be worked first.
 */
export function close(input: TransitionInput, command: CloseCommand): TransitionResult {
  if (!(command.isTask && input.ticket.status === 'open')) return closeWorking(input, command);
  const started = start(input, { type: 'start', personId: command.personId, at: command.at });
  return closeWorking({ ...input, ...started }, command);
}

function closeWorking(input: TransitionInput, command: CloseCommand): TransitionResult {
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
    ...(command.taskDownMin === undefined ? {} : { taskDownMin: command.taskDownMin }),
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
