import type { PoolClient } from 'pg';
import { LOCKOUT_EVENT_TYPES, type EventType } from '@uptimo/domain';

/** The status and work type of a ticket that is still live (open, working or waiting); `undefined` otherwise. */
export async function liveTicket(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<{ status: string; workType: string | null } | undefined> {
  const row = (
    await client.query(
      `SELECT status, work_type FROM ticket
        WHERE tenant_id = $1 AND id = $2 AND status IN ('open', 'working', 'waiting')`,
      [tenantId, ticketId],
    )
  ).rows[0];
  return row && { status: row.status as string, workType: row.work_type as string | null };
}

/** The breakdown category on the ticket's latest stored report, if it has a report. */
export async function reportCategory(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<string | null> {
  const row = (
    await client.query(
      `SELECT breakdown_category FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = $2
        ORDER BY submitted_at DESC LIMIT 1`,
      [tenantId, ticketId],
    )
  ).rows[0];
  return (row?.breakdown_category as string | null | undefined) ?? null;
}

/** The ticket's lockout-relevant events, oldest first. */
export async function lockoutHistory(
  client: PoolClient,
  ticketId: string,
): Promise<{ type: EventType; at: Date; actingPersonId: string | null }[]> {
  const { rows } = await client.query(
    `SELECT type, at, acting_person_id FROM ticket_event
      WHERE ticket_id = $1 AND type = ANY($2) ORDER BY seq`,
    [ticketId, LOCKOUT_EVENT_TYPES],
  );
  return rows.map((e) => ({
    type: e.type as EventType,
    at: new Date(e.at),
    actingPersonId: e.acting_person_id as string | null,
  }));
}
