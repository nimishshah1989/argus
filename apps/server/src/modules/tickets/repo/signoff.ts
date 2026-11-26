import type { PoolClient } from 'pg';

export interface AwaitingSignoffRow {
  id: string;
  ref: string;
  machineId: string | null;
  machineCode: string | null;
  cell: string | null;
  closedAt: Date;
  /** The database's own text for `closedAt`, microseconds included: what the next page's cursor must carry. */
  closedAtText: string;
}

/** Where the previous page ended: the next one starts after this close. */
export interface SignoffCursor {
  /** `AwaitingSignoffRow.closedAtText`, not a `Date`: a Date has milliseconds, the database microseconds. */
  closedAt: string;
  id: string;
}

/**
 * Closed tickets whose latest close asked production to sign off and has no confirm or dispute after it, oldest
 * close first (the longest wait at the top), one page at a time. Machines in `offBoard` (a hidden group or a segment
 * off the board) are left out. Whether the time to answer has run out is not known here (the sign-off clock is
 * accountability's).
 */
export async function closedAwaitingSignoff(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  page: { limit: number; after?: SignoffCursor; offBoard: readonly string[] },
): Promise<AwaitingSignoffRow[]> {
  const result = await client.query(
    `SELECT t.id, t.ref, t.machine_id, t.machine_snapshot, t.closed_at, t.closed_at::text AS closed_at_text
     FROM ticket t
     WHERE t.tenant_id = $1 AND t.status = 'closed' AND t.closed_at IS NOT NULL
       AND (t.machine_id IS NULL OR t.machine_id <> ALL($3::uuid[]))
       AND ($4::timestamptz IS NULL OR (t.closed_at, t.id) > ($4::timestamptz, $5::uuid))
       AND EXISTS (
         SELECT 1 FROM ticket_event c
         WHERE c.tenant_id = t.tenant_id AND c.ticket_id = t.id AND c.type = 'close'
           AND c.payload->>'handbackRequested' = 'true'
           AND NOT EXISTS (
             SELECT 1 FROM ticket_event a
             WHERE a.tenant_id = t.tenant_id AND a.ticket_id = t.id AND a.seq > c.seq
               AND a.type IN ('handback_confirm', 'handback_dispute')))
     ORDER BY t.closed_at ASC, t.id ASC LIMIT $2`,
    [tenantId, page.limit, page.offBoard, page.after?.closedAt ?? null, page.after?.id ?? null],
  );
  return result.rows.map((row) => ({
    ...whereOf(row),
    closedAt: row.closed_at as Date,
    closedAtText: row.closed_at_text as string,
  }));
}

/** A ticket's id, reference and the machine and cell it was reported on. */
export type SignoffTicketRow = Pick<
  AwaitingSignoffRow,
  'id' | 'ref' | 'machineId' | 'machineCode' | 'cell'
>;

function whereOf(row: Record<string, unknown>): SignoffTicketRow {
  const snapshot = (row.machine_snapshot ?? {}) as { code?: string | null; cell?: string | null };
  return {
    id: row.id as string,
    ref: row.ref as string,
    machineId: (row.machine_id as string | null) ?? null,
    machineCode: snapshot.code ?? null,
    cell: snapshot.cell ?? null,
  };
}

/**
 * Tickets whose sign-off may have an outcome since `since`: production confirmed or disputed it since then, or it is
 * one of `alsoIds` (the clocks that ran out, which accountability knows). Machines in `offBoard` are left out; the
 * sign-off itself decides the outcome.
 */
export async function signoffOutcomeTickets(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  query: { since: Date; offBoard: readonly string[]; alsoIds: readonly string[]; limit: number },
): Promise<SignoffTicketRow[]> {
  const result = await client.query(
    `SELECT t.id, t.ref, t.machine_id, t.machine_snapshot
     FROM ticket t
     WHERE t.tenant_id = $1
       AND (t.machine_id IS NULL OR t.machine_id <> ALL($3::uuid[]))
       -- an answer is a command, and every command saves the ticket: nothing older can hold one
       AND (t.id = ANY($4::uuid[]) OR t.updated_at >= $2 AND EXISTS (
         SELECT 1 FROM ticket_event a
         WHERE a.tenant_id = t.tenant_id AND a.ticket_id = t.id AND a.at >= $2
           AND a.type IN ('handback_confirm', 'handback_dispute')))
     ORDER BY t.updated_at DESC, t.id LIMIT $5`,
    [tenantId, query.since, query.offBoard, query.alsoIds, query.limit],
  );
  return result.rows.map(whereOf);
}
