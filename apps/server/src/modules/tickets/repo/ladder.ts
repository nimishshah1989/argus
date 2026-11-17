import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface LadderEventRow {
  ticket_id: string;
  type: 'escalate' | 'escalation_ack';
  at: Date;
  payload: Record<string, unknown>;
}

/**
 * The two event kinds the ladder reads, for a page of tickets, oldest first. One narrow read: the escalation state
 * part never pays for the payloads of every other event. Row security keeps other plants' rows out; the tenant
 * predicate says which plant the read is for.
 */
export async function ladderEventRows(
  tx: Db,
  tenantId: string,
  ticketIds: string[],
): Promise<LadderEventRow[]> {
  const { rows } = await tx.query<LadderEventRow>(
    `SELECT ticket_id, type, at, payload FROM ticket_event
      WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) AND type IN ('escalate','escalation_ack')
      ORDER BY ticket_id, seq`,
    [tenantId, ticketIds],
  );
  return rows;
}
