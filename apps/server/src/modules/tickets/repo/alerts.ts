import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface AlertFacts {
  kind: 'stopped' | 'support' | 'general';
  status: string;
  reportedByPersonId: string | null;
  /** Who wrote the ticket's first line: the person acting when it was raised, never a reporter they named. */
  raisedByPersonId: string | null;
  closedByPersonId: string | null;
  closedAt: Date | null;
  leadPersonId: string | null;
  lastEventSeq: number;
}

/** What an alert about a ticket needs to know: its kind, state, who reported it and who closed it. */
export async function ticketAlertFacts(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<AlertFacts | null> {
  const row = (
    await tx.query(
      `SELECT t.kind, t.status, t.reported_by_person_id, t.closed_by_person_id, t.closed_at, t.lead_person_id,
              t.last_event_seq,
              (SELECT e.acting_person_id FROM ticket_event e WHERE e.ticket_id = t.id AND e.tenant_id = t.tenant_id AND e.type = 'down'
                ORDER BY e.seq LIMIT 1) AS raised_by_person_id
         FROM ticket t WHERE t.tenant_id = $1 AND t.id = $2`,
      [tenantId, ticketId],
    )
  ).rows[0];
  if (!row) return null;
  return {
    kind: row.kind,
    status: row.status,
    reportedByPersonId: row.reported_by_person_id,
    raisedByPersonId: row.raised_by_person_id,
    closedByPersonId: row.closed_by_person_id,
    closedAt: row.closed_at,
    leadPersonId: row.lead_person_id,
    lastEventSeq: row.last_event_seq,
  };
}
