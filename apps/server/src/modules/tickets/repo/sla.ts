import type { PoolClient, QueryResult } from 'pg';
import type { SlaPolicy } from '@uptimo/domain';

type Db = Pick<PoolClient, 'query'>;

export interface SlaTicketRow {
  id: string;
  kind: 'stopped' | 'support' | 'general';
  severity: SlaPolicy['severity'];
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  reported_at: Date;
  closed_at: Date | null;
  raised_channel: string;
}

export async function ticketEventRows(tx: Db, ticketIds: string[]): Promise<QueryResult['rows']> {
  const events = await tx.query(
    `SELECT ticket_id, seq, type, at, login_id, acting_person_id, text, payload
     FROM ticket_event WHERE ticket_id = ANY($1::uuid[]) ORDER BY ticket_id, seq`,
    [ticketIds],
  );
  return events.rows;
}

export async function slaTicketRows(
  tx: Db,
  tenantId: string,
  ticketIds: string[],
): Promise<SlaTicketRow[]> {
  const tickets = await tx.query<SlaTicketRow>(
    `SELECT id, kind, severity, status, reported_at, closed_at, raised_channel
     FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, ticketIds],
  );
  return tickets.rows;
}

/** Row-lock a ticket for update; false when it does not exist for the tenant. */
export async function lockTicket(tx: Db, tenantId: string, ticketId: string): Promise<boolean> {
  const locked = await tx.query('SELECT id FROM ticket WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [
    tenantId,
    ticketId,
  ]);
  return locked.rowCount === 1;
}

export async function slaCandidateIds(tx: Db, tenantId: string): Promise<string[]> {
  const candidates = await tx.query(
    "SELECT id FROM ticket WHERE tenant_id = $1 AND raised_channel <> 'backfill' ORDER BY id",
    [tenantId],
  );
  return candidates.rows.map((row) => row.id as string);
}

/** Tickets still being worked (not an import of history): their clocks run and need checking. */
export async function slaActiveIds(tx: Db, tenantId: string): Promise<string[]> {
  const tickets = await tx.query<{ id: string }>(
    `SELECT id FROM ticket
       WHERE tenant_id=$1 AND raised_channel <> 'backfill' AND status IN ('open','working','waiting')
       ORDER BY id`,
    [tenantId],
  );
  return tickets.rows.map((ticket) => ticket.id);
}
