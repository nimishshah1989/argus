import type { PoolClient } from 'pg';
import { canAcknowledge, offersAcknowledge, type Role } from '@uptimo/domain';
import { isOnRoster, type PartView } from '../../kernel/index.js';
import { ticketAckFacts } from '../tickets/index.js';

/**
 * Whether to offer this actor the Acknowledge button on each ticket: the domain's own rule, the one the command is
 * built on, plus the clock still running. One roster read for the whole reply (the answer is about the actor, not the ticket), and none at all
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
  const onRoster = await isOnRoster(client, tenantId, actor.personId, now);
  for (const fact of await ticketAckFacts(client, tenantId, ticketIds)) {
    answers.set(
      fact.id,
      offersAcknowledge(ctx, fact, { onRoster, clockStopped: fact.clockStopped }),
    );
  }
  return answers;
}
