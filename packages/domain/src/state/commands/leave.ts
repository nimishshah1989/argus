import type { CrewMember } from '../../types.js';
import { canWork } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function leave(
  input: TransitionInput,
  command: Extract<Command, { type: 'leave' }>,
): TransitionResult {
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  )
    throw new TransitionError('Not allowed');
  if (!input.crew.some((member) => member.personId === command.personId && !member.leftAt))
    throw new TransitionError('Not on this ticket');
  const at = clampAt(input.ctx.now, input);
  const crew: CrewMember[] = input.crew.map((member) =>
    member.personId === command.personId
      ? { ...member, leftAt: at, leftReason: command.reason }
      : member,
  );
  const segments = input.segments.map((segment) =>
    segment.personId === command.personId && !segment.endedAt
      ? { ...segment, endedAt: at }
      : segment,
  );
  let leadPersonId = input.ticket.leadPersonId;
  if (input.ticket.leadPersonId === command.personId) {
    leadPersonId =
      crew.find((member) => member.role === 'primary' && !member.leftAt)?.personId ?? null;
  }
  return apply(input, {
    ticket: { leadPersonId },
    event: { type: 'leave', reason: command.reason },
    at,
    segments,
    crew,
  });
}
