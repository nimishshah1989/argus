import type { PoolClient } from 'pg';
import { TICKET_COLUMNS } from './ticket.js';

/**
 * Closed tickets raised by a person or a channel: not `import` or `backfill`, whose stored figures are another
 * system's numbers (09). Open tickets are left out too: their cached figures were right at their last change.
 */
export async function driftCandidateRows(
  client: PoolClient,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await client.query(
    `SELECT ${TICKET_COLUMNS} FROM ticket
     WHERE tenant_id = $1 AND status = 'closed' AND raised_channel NOT IN ('import', 'backfill')
     ORDER BY ref`,
    [tenantId],
  );
  return result.rows;
}
