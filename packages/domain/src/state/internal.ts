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
  const lead = input.ticket.leadPersonId;
  const onJob = resumer === lead || activeCrew(input).some((m) => m.personId === resumer);
  return onJob && lead ? lead : resumer;
}
