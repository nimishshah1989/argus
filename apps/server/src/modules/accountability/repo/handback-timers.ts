import type { PoolClient } from 'pg';

/** Of these tickets, those whose sign-off clock has already run out (it fired): nobody needs to ask about them again. */
export async function firedHandbackTickets(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  ticketIds: readonly string[],
): Promise<Set<string>> {
  if (ticketIds.length === 0) return new Set();
  const result = await client.query(
    `SELECT ticket_id FROM sla_timer
     WHERE tenant_id = $1 AND kind = 'handback' AND fired_at IS NOT NULL AND ticket_id = ANY($2::uuid[])`,
    [tenantId, ticketIds],
  );
  return new Set(result.rows.map((row) => row.ticket_id as string));
}
