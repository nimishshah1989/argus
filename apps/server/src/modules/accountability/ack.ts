import type { PoolClient } from 'pg';
import { acknowledgeRefusal, canAcknowledge, type Role } from '@uptimo/domain';
import type { PartView } from '../../kernel/index.js';
import { ticketAckFacts } from '../tickets/index.js';
import { onRosterAt } from './roster.js';

/**
 * Whether this actor may acknowledge each ticket now: the domain's own rule, so the button and the command never
 * disagree. One roster read for the whole reply (the answer is about the actor, not the ticket), and none at all
 * for a role that can never acknowledge. A shared phone with nobody chosen has nobody to look up: false everywhere.
 */
export async function loadCanAcknowledge(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  { now, actor }: PartView,
): Promise<Map<string, boolean>> {
  const answers = new Map(ticketIds.map((id) => [id, false]));
  if (!actor || actor.personId === null || ticketIds.length === 0) return answers;
  const ctx = {
    role: actor.role as Role,
    loginId: actor.loginId,
    personId: actor.personId,
    shared: actor.shared,
  };
  // the role alone rules out an operator, the board and an admin, whatever the roster says
  if (!canAcknowledge(ctx, { onRoster: true, assignedToActor: true })) return answers;
  const onRoster = await onRosterAt(client, tenantId, actor.personId, now);
  for (const fact of await ticketAckFacts(client, tenantId, ticketIds)) {
    const refusal = acknowledgeRefusal(ctx, fact, {
      onRoster,
      alreadyAcknowledged: fact.acknowledged,
    });
    answers.set(fact.id, refusal === null);
  }
  return answers;
}
