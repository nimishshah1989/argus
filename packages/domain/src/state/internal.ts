import type { CrewMember } from '../types.js';
import type { TransitionInput } from './types.js';

/** A command's time: not before `earliest`, not after now. */
export function clampFrom(at: Date, earliest: Date, input: TransitionInput): Date {
  const time = at.getTime() < earliest.getTime() ? earliest : at;
  return time.getTime() > input.ctx.now.getTime() ? input.ctx.now : time;
}

export function activeCrew(input: TransitionInput): CrewMember[] {
  return input.crew.filter((member) => !member.leftAt);
}

/** His rule at resume: the lead stays lead when the lead or someone on the crew resumes; anyone else takes over. */
export function leadAfterResume(input: TransitionInput, resumer: string): string {
  return resumeLead(input.ticket.leadPersonId, activeCrew(input), resumer);
}

export function resumeLead(lead: string | null, crew: CrewMember[], resumer: string): string {
  const onJob = resumer === lead || crew.some((m) => m.personId === resumer && !m.leftAt);
  return onJob && lead ? lead : resumer;
}
