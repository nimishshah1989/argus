import { remainingSlaMinutes, slaBreached } from './sla.js';
import type { SlaProjectionInput, SlaTimerProjection } from './sla.js';
import { currentSignoff } from './signoff.js';

const MINUTE_MS = 60_000;

/**
 * The sign-off clock: how long production has to confirm or dispute a fix. Runs from the close that asked, is due
 * after the policy's minutes and stops on the answer. Wall-clock minutes, as the pause clock. A late answer is
 * still recorded and marks the clock breached. No clock without a request or without a limit.
 */
export function projectHandbackTimer(input: SlaProjectionInput): SlaTimerProjection | null {
  const minutes = input.policy.handbackMinutes;
  if (minutes == null) return null;
  const signoff = currentSignoff(input.events, input.now);
  if (!signoff) return null;
  const asked = signoff.request.at;
  const dueAt = new Date(asked.getTime() + minutes * MINUTE_MS);
  const answer = signoff.answer;
  return {
    id: `${input.ticket.id}:handback`,
    state: answer ? 'stopped' : 'running',
    breached: answer ? dueAt < answer.at : slaBreached(dueAt, input.now),
    dueAt,
    pausedAt: null,
    stoppedAt: answer?.at ?? null,
    remainingMinutes: remainingSlaMinutes(dueAt, answer?.at ?? input.now),
    stopReason: answer ? (answer.type === 'handback_confirm' ? 'confirmed' : 'disputed') : null,
  };
}
