import type { WorkSegment } from '../../types.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import { activeCrew, leadAfterResume } from '../internal.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function resume(
  input: TransitionInput,
  command: Extract<Command, { type: 'resume' }>,
): TransitionResult {
  if (input.ticket.status !== 'waiting')
    throw new TransitionError('Can only resume a waiting ticket');
  const at = clampAt(input.ctx.now, input);
  const lead = leadAfterResume(input, command.personId);
  const ticket = {
    status: 'working' as const,
    leadPersonId: lead,
    segmentStartedAt: at,
    waitReason: null,
    waitSince: null,
  };
  // his app restarts every crew member's clock at resume; the lead's clock opens as the lead's own
  const crewSegments: WorkSegment[] = activeCrew(input)
    .filter((member) => member.personId !== lead)
    .map((member) => ({ personId: member.personId, role: member.role, startedAt: at }));
  const segments: WorkSegment[] = [
    ...input.segments,
    { personId: lead, role: 'lead', startedAt: at },
    ...crewSegments,
  ];
  return apply(input, { ticket, event: { type: 'resume' }, at, segments });
}
