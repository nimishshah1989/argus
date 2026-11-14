import type { PoolClient } from 'pg';

/**
 * Of these tickets, those whose sign-off clock has fired and whose time is still past at `now`: nobody needs to ask
 * about them again. A clock that fired and then got a later time (the plant raised its limit) is not in the list, so
 * the sign-off itself decides about that ticket.
 */
export async function firedHandbackTickets(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  ticketIds: readonly string[],
  now: Date,
): Promise<Set<string>> {
  if (ticketIds.length === 0) return new Set();
  const result = await client.query(
    `SELECT ticket_id FROM sla_timer
     WHERE tenant_id = $1 AND kind = 'handback' AND fired_at IS NOT NULL AND due_at <= $3::timestamptz
       AND ticket_id = ANY($2::uuid[])`,
    [tenantId, ticketIds, now],
  );
  return new Set(result.rows.map((row) => row.ticket_id as string));
}
