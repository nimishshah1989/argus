import type { PoolClient } from 'pg';
import { currentSignoff, projectHandbackTimer, signoffTurnaround } from '@uptimo/domain';
import type { Handback } from '@uptimo/shared';
import { effectiveNow, loadContexts, slaInput, type SlaContext } from './sla.js';

function statusOf(
  answer: { type: string } | null,
  clock: { breached: boolean } | null,
): Handback['status'] {
  if (!answer) return clock?.breached ? 'timed_out' : 'requested';
  return answer.type === 'handback_dispute' ? 'disputed' : 'confirmed';
}

function toHandback(context: SlaContext, now: Date): Handback | null {
  const at = effectiveNow(context, now);
  const signoff = currentSignoff(context.events, at);
  if (!signoff) return null;
  const { request, answer } = signoff;
  const clock = projectHandbackTimer(slaInput(context, now));
  const disputed = answer?.type === 'handback_dispute';
  return {
    status: statusOf(answer, clock),
    requestedAt: request.at.toISOString(),
    dueAt: clock?.dueAt?.toISOString() ?? null,
    respondedAt: answer?.at.toISOString() ?? null,
    respondedByPersonId: answer?.actingPersonId ?? null,
    disputeReason: disputed ? (answer.reason ?? null) : null,
    reopenCount: context.events.filter((e) => e.type === 'handback_dispute' && e.at <= at).length,
    turnaround: signoffTurnaround(context.events, context.row.reported_at, at)!,
  };
}

/** The sign-off of every ticket in a reply, in one read; null where nobody was asked. */
export async function loadHandbacks(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  now: Date,
): Promise<Map<string, Handback | null>> {
  const contexts = await loadContexts(client, tenantId, ticketIds, true);
  return new Map(
    ticketIds.map((id) => {
      const context = contexts.get(id);
      return [id, context ? toHandback(context, now) : null];
    }),
  );
}
