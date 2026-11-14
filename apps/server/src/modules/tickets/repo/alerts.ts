import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface AlertFacts {
  kind: 'stopped' | 'support' | 'general';
  status: string;
  reportedByPersonId: string | null;
  closedByPersonId: string | null;
  closedAt: Date | null;
}

/** What an alert about a ticket needs to know: its kind, state, who reported it and who closed it. */
export async function ticketAlertFacts(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<AlertFacts | null> {
  const row = (
    await tx.query(
      `SELECT kind, status, reported_by_person_id, closed_by_person_id, closed_at
         FROM ticket WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ticketId],
    )
  ).rows[0];
  if (!row) return null;
  return {
    kind: row.kind,
    status: row.status,
    reportedByPersonId: row.reported_by_person_id,
    closedByPersonId: row.closed_by_person_id,
    closedAt: row.closed_at,
  };
}
