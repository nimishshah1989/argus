import type { PoolClient } from 'pg';
import { acknowledgeRefusal, canAcknowledge, type Role } from '@uptimo/domain';
import type { PartView } from '../../kernel/index.js';
import { onRosterAt } from './roster.js';

interface AckRow {
  id: string;
  status: string;
  assigned_to_person_id: string | null;
  acknowledged: boolean;
}

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
  const { rows } = await client.query<AckRow>(
    `SELECT t.id, t.status, t.assigned_to_person_id,
            EXISTS (SELECT 1 FROM ticket_event e WHERE e.ticket_id = t.id AND e.type = 'acknowledge') AS acknowledged
       FROM ticket t WHERE t.tenant_id = $1 AND t.id = ANY($2::uuid[])`,
    [tenantId, ticketIds],
  );
  for (const row of rows) {
    const ticket = { status: row.status, assignedToPersonId: row.assigned_to_person_id };
    const refusal = acknowledgeRefusal(ctx, ticket, {
      onRoster,
      alreadyAcknowledged: row.acknowledged,
    });
    answers.set(row.id, refusal === null);
  }
  return answers;
}
