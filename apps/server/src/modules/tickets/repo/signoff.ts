import type { PoolClient } from 'pg';

export interface AwaitingSignoffRow {
  id: string;
  ref: string;
  machineId: string | null;
  machineCode: string | null;
  cell: string | null;
  closedAt: Date;
}

/**
 * Closed tickets whose latest close asked production to sign off and has no confirm or dispute after it, newest
 * close first. Whether the time to answer has run out is not known here (the sign-off clock is accountability's).
 */
export async function closedAwaitingSignoff(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  limit: number,
): Promise<AwaitingSignoffRow[]> {
  const result = await client.query(
    `SELECT t.id, t.ref, t.machine_id, t.machine_snapshot, t.closed_at FROM ticket t
     WHERE t.tenant_id = $1 AND t.status = 'closed' AND t.closed_at IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM ticket_event c
         WHERE c.ticket_id = t.id AND c.type = 'close' AND c.payload->>'handbackRequested' = 'true'
           AND NOT EXISTS (
             SELECT 1 FROM ticket_event a
             WHERE a.ticket_id = t.id AND a.seq > c.seq AND a.type IN ('handback_confirm', 'handback_dispute')))
     ORDER BY t.closed_at DESC, t.id LIMIT $2`,
    [tenantId, limit],
  );
  return result.rows.map((row) => {
    const snapshot = (row.machine_snapshot ?? {}) as { code?: string | null; cell?: string | null };
    return {
      id: row.id as string,
      ref: row.ref as string,
      machineId: (row.machine_id as string | null) ?? null,
      machineCode: snapshot.code ?? null,
      cell: snapshot.cell ?? null,
      closedAt: row.closed_at as Date,
    };
  });
}
