import type { PoolClient } from 'pg';
import { LOCKOUT_EVENT_TYPES, workersAfterResume, type EventType } from '@uptimo/domain';
import { loadCrew } from './ticket.js';

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

/** The latest stored report category of each ticket in one read, for a whole list reply. */
export async function reportCategories(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<Map<string, string | null>> {
  if (ticketIds.length === 0) return new Map();
  const { rows } = await client.query(
    `SELECT DISTINCT ON (ticket_id) ticket_id, breakdown_category FROM breakdown_report
      WHERE tenant_id = $1 AND ticket_id = ANY($2) ORDER BY ticket_id, submitted_at DESC`,
    [tenantId, ticketIds],
  );
  return new Map(
    rows.map((row) => [row.ticket_id as string, (row.breakdown_category as string | null) ?? null]),
  );
}

/** One lockout-relevant event, as both the single-ticket and the batched read shape it. */
export interface LockoutEvent {
  type: EventType;
  at: Date;
  actingPersonId: string | null;
  stepCodes?: string[];
}

function toLockoutEvent(e: Record<string, unknown>): LockoutEvent {
  return {
    type: e.type as EventType,
    at: new Date(e.at as string),
    actingPersonId: e.acting_person_id as string | null,
    stepCodes: (e.step_codes as string[] | null) ?? undefined,
  };
}

/** The ticket's lockout-relevant events, oldest first. */
export async function lockoutHistory(
  client: PoolClient,
  ticketId: string,
): Promise<LockoutEvent[]> {
  const { rows } = await client.query(
    `SELECT type, at, acting_person_id, payload->'stepCodes' AS step_codes FROM ticket_event
      WHERE ticket_id = $1 AND type = ANY($2) ORDER BY seq`,
    [ticketId, LOCKOUT_EVENT_TYPES],
  );
  return rows.map(toLockoutEvent);
}

/** The lockout-relevant events of several tickets in one read, each ticket's oldest first. */
export async function lockoutHistories(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<Map<string, LockoutEvent[]>> {
  const result = new Map<string, LockoutEvent[]>();
  if (ticketIds.length === 0) return result;
  const { rows } = await client.query(
    `SELECT ticket_id, type, at, acting_person_id, payload->'stepCodes' AS step_codes FROM ticket_event
      WHERE tenant_id = $1 AND ticket_id = ANY($2) AND type = ANY($3) ORDER BY ticket_id, seq`,
    [tenantId, ticketIds, LOCKOUT_EVENT_TYPES],
  );
  for (const row of rows) {
    const id = row.ticket_id as string;
    const list = result.get(id) ?? [];
    list.push(toLockoutEvent(row));
    result.set(id, list);
  }
  return result;
}

/** Everyone who will be working once `resumer` resumes the ticket: its lead after the resume and the crew still on. */
export async function peopleWorkingAfterResume(
  client: PoolClient,
  ticketId: string,
  resumer: string,
): Promise<string[]> {
  const lead = (await client.query('SELECT lead_person_id FROM ticket WHERE id = $1', [ticketId]))
    .rows[0]?.lead_person_id as string | null | undefined;
  return workersAfterResume(lead ?? null, await loadCrew(client, ticketId), resumer);
}
