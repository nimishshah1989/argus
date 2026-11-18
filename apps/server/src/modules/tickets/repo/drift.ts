import type { PoolClient } from 'pg';
import { BREAKDOWN_CHANNELS } from '@uptimo/shared';
import { TICKET_COLUMNS } from './ticket.js';

/**
 * Closed live breakdowns: not `import` or `backfill`, whose stored figures are another system's numbers (09), and
 * not planned `pm`/`inspection` work. Open tickets are left out too: their cached figures were right at their last
 * change.
 */
export async function driftCandidateRows(
  client: PoolClient,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await client.query(
    `SELECT ${TICKET_COLUMNS} FROM ticket
     WHERE tenant_id = $1 AND status = 'closed' AND raised_channel = ANY($2::text[])
     ORDER BY ref`,
    [tenantId, [...BREAKDOWN_CHANNELS]],
  );
  return result.rows;
}
