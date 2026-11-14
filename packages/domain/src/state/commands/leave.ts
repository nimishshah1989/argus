import type { CrewMember, WorkSegment } from '../../types.js';
import { canWork } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import { activeCrew } from '../internal.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

/** The person running the job leaves: the earliest-joined primary takes over with a fresh lead clock (his rule). */
function leaveAsLead(
  input: TransitionInput,
  command: Extract<Command, { type: 'leave' }>,
  at: Date,
): TransitionResult {
  const next = activeCrew(input).find(
    (member) => member.role === 'primary' && member.personId !== command.personId,
  );
  if (!next) throw new TransitionError('Someone must take over first: join a primary or transfer');
  const working = input.ticket.status === 'working';
  const closed: WorkSegment[] = input.segments.map((segment) =>
    !segment.endedAt && [command.personId, next.personId].includes(segment.personId)
      ? { ...segment, endedAt: at }
      : segment,
  );
  const segments = working
    ? [...closed, { personId: next.personId, role: 'lead' as const, startedAt: at }]
    : closed;
  const gone: CrewMember = {
    personId: command.personId,
    role: 'primary',
    leftAt: at,
    leftReason: command.reason,
  };
  const result = apply(input, {
    ticket: { leadPersonId: next.personId, segmentStartedAt: working ? at : null },
    event: { type: 'leave', reason: command.reason },
    at,
    segments,
    crew: [...input.crew, gone],
  });
  result.events.push({ type: 'lead', at, reason: next.personId });
  result.ticket.lastEventSeq += 1;
  return result;
}

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
  const at = clampAt(input.ctx.now, input);
  if (
    command.personId === input.ticket.leadPersonId &&
    ['working', 'waiting'].includes(input.ticket.status)
  )
    return leaveAsLead(input, command, at);
  if (!input.crew.some((member) => member.personId === command.personId && !member.leftAt))
    throw new TransitionError('Not on this ticket');
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
  return apply(input, {
    ticket: {},
    event: { type: 'leave', reason: command.reason },
    at,
    segments,
    crew,
  });
}
