import type { PoolClient } from 'pg';
import type { EventType } from '@uptimo/domain';

/** The history that decides whether a lockout confirmation still stands. */
const LOCKOUT_EVENTS = ['lockout_confirmed', 'start', 'pickup', 'cancel', 'restore'];

/** The work type of the ticket when it is open; `undefined` when it is not open (or not this plant's). */
export async function openTicketWorkType(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<{ workType: string | null } | undefined> {
  const row = (
    await client.query(
      "SELECT work_type FROM ticket WHERE tenant_id = $1 AND id = $2 AND status = 'open'",
      [tenantId, ticketId],
    )
  ).rows[0];
  return row && { workType: row.work_type as string | null };
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
    [ticketId, LOCKOUT_EVENTS],
  );
  return rows.map((e) => ({
    type: e.type as EventType,
    at: new Date(e.at),
    actingPersonId: e.acting_person_id as string | null,
  }));
}
