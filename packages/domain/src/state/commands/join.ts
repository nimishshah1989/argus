import type { CrewMember, WorkSegment } from '../../types.js';
import { canWork } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function join(
  input: TransitionInput,
  command: Extract<Command, { type: 'join' }>,
): TransitionResult {
  if (!['working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Can only join a live ticket');
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  )
    throw new TransitionError('Not allowed');
  if (input.crew.some((member) => member.personId === command.personId && !member.leftAt))
    throw new TransitionError('Already on this ticket');
  const at = clampAt(input.ctx.now, input);
  const crew: CrewMember[] = [...input.crew, { personId: command.personId, role: command.role }];
  const segments =
    input.ticket.status === 'working'
      ? [
          ...input.segments,
          { personId: command.personId, role: command.role, startedAt: at } as WorkSegment,
        ]
      : input.segments;
  return apply(input, { ticket: {}, event: { type: 'join' }, at, segments, crew });
}
