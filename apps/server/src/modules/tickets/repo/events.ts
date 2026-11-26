import type { PoolClient } from 'pg';
import { whyWhyPayloadSchema, type OemCausePayload, type WhyWhyPayload } from '@uptimo/shared';
import type { LoadedEvent } from '../mapper.js';

type Db = Pick<PoolClient, 'query'>;

/** Rehydrate a correction timestamp into a Date for SLA projection. */
export function reviveCorrection(change: unknown): unknown {
  const value = change as { field?: string; to?: unknown };
  if (
    (value.field === 'startedAt' || value.field === 'closedAt' || value.field === 'reportedAt') &&
    typeof value.to === 'string'
  ) {
    return { ...value, to: new Date(value.to) };
  }
  return change;
}

/** The ticket facts a Why-Why guard reads: the kind and whether it is closed. */
export interface WhyWhyTicket {
  kind: string;
  status: string;
}

export async function whyWhyTicket(
  client: Db,
  tenantId: string,
  ticketId: string,
): Promise<WhyWhyTicket | null> {
  const row = (
    await client.query('SELECT kind, status FROM ticket WHERE tenant_id = $1 AND id = $2', [
      tenantId,
      ticketId,
    ])
  ).rows[0];
  return row ? { kind: row.kind as string, status: row.status as string } : null;
}

/** The latest saved Why-Why record of one ticket, or null; a payload that is not the record's shape is skipped. */
export async function latestWhyWhy(
  client: Db,
  tenantId: string,
  ticketId: string,
): Promise<WhyWhyPayload | null> {
  const rows = (
    await client.query(
      `SELECT payload FROM ticket_event
        WHERE tenant_id = $1 AND ticket_id = $2 AND type = 'why_why'
        ORDER BY seq DESC`,
      [tenantId, ticketId],
    )
  ).rows;
  for (const row of rows) {
    const parsed = whyWhyPayloadSchema.safeParse(row.payload);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export interface AppendWhyWhyInput {
  tenantId: string;
  ticketId: string;
  at: Date;
  loginId: string;
  actingPersonId: string;
  payload: WhyWhyPayload;
}

export interface WhyWhyEvent {
  id: string;
  seq: number;
  at: Date;
}

/**
 * Appends one why_why event as the ticket's next event (R2: nothing updates or deletes one). The update of the
 * ticket's event counter is the lock, and its WHERE is the closed-breakdown guard: null when the ticket is not
 * a closed breakdown, so a save cannot slip onto one that closed or changed kind in between.
 */
export async function appendWhyWhyEvent(
  client: Db,
  input: AppendWhyWhyInput,
): Promise<WhyWhyEvent | null> {
  const ticket = (
    await client.query(
      `UPDATE ticket SET last_event_seq = GREATEST(last_event_seq,
         (SELECT COALESCE(MAX(seq), -1) FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2)) + 1
       WHERE tenant_id = $1 AND id = $2 AND kind = 'stopped' AND status = 'closed'
       RETURNING last_event_seq`,
      [input.tenantId, input.ticketId],
    )
  ).rows[0];
  if (!ticket) return null;
  const row = (
    await client.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, login_id, acting_person_id, payload)
       VALUES ($1, $2, $3, 'why_why', $4, $5, $6, $7)
       RETURNING id, seq, at`,
      [
        input.tenantId,
        input.ticketId,
        ticket.last_event_seq,
        input.at,
        input.loginId,
        input.actingPersonId,
        JSON.stringify(input.payload),
      ],
    )
  ).rows[0];
  return { id: row.id as string, seq: row.seq as number, at: row.at as Date };
}

/** The latest why_why event of every ticket that has one, for the analytics loader. */
export async function whyWhyEventRows(
  client: Db,
): Promise<{ ticketId: string; payload: unknown }[]> {
  return (
    await client.query(
      `SELECT DISTINCT ON (ticket_id) ticket_id, payload
         FROM ticket_event WHERE type = 'why_why'
        ORDER BY ticket_id, seq DESC`,
    )
  ).rows.map((row) => ({ ticketId: row.ticket_id as string, payload: row.payload }));
}

export interface AppendOemCauseInput {
  tenantId: string;
  ticketId: string;
  at: Date;
  loginId: string;
  actingPersonId: string;
  payload: OemCausePayload;
}

/**
 * Appends one oem_cause event as the ticket's next event (ADR 0051; nothing updates or deletes one), with the same
 * closed-breakdown guard in the counter update as appendWhyWhyEvent: null when the ticket is not a closed breakdown.
 */
export async function appendOemCauseEvent(
  client: Db,
  input: AppendOemCauseInput,
): Promise<WhyWhyEvent | null> {
  const ticket = (
    await client.query(
      `UPDATE ticket SET last_event_seq = GREATEST(last_event_seq,
         (SELECT COALESCE(MAX(seq), -1) FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2)) + 1
       WHERE tenant_id = $1 AND id = $2 AND kind = 'stopped' AND status = 'closed'
       RETURNING last_event_seq`,
      [input.tenantId, input.ticketId],
    )
  ).rows[0];
  if (!ticket) return null;
  const row = (
    await client.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, login_id, acting_person_id, payload)
       VALUES ($1, $2, $3, 'oem_cause', $4, $5, $6, $7)
       RETURNING id, seq, at`,
      [
        input.tenantId,
        input.ticketId,
        ticket.last_event_seq,
        input.at,
        input.loginId,
        input.actingPersonId,
        JSON.stringify(input.payload),
      ],
    )
  ).rows[0];
  return { id: row.id as string, seq: row.seq as number, at: row.at as Date };
}

/** The latest oem_cause event of every ticket that has one (DISTINCT ON), for the analytics loader. */
export async function oemCauseEventRows(
  client: Db,
): Promise<{ ticketId: string; payload: unknown }[]> {
  return (
    await client.query(
      `SELECT DISTINCT ON (ticket_id) ticket_id, payload
         FROM ticket_event WHERE type = 'oem_cause'
        ORDER BY ticket_id, seq DESC`,
    )
  ).rows.map((row) => ({ ticketId: row.ticket_id as string, payload: row.payload }));
}

/** Load the ordered event history, including correction and pause snapshots. */
export async function loadEvents(client: PoolClient, ticketId: string): Promise<LoadedEvent[]> {
  const result = await client.query(
    `SELECT id, seq, type, at, login_id, acting_person_id, text, payload
       FROM ticket_event WHERE ticket_id = $1 ORDER BY seq`,
    [ticketId],
  );
  return result.rows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return {
      type: row.type as LoadedEvent['type'],
      at: new Date(row.at as string | number | Date),
      reason: (payload.reason as string | undefined) ?? (row.text as string | undefined),
      isVendor: payload.isVendor as boolean | undefined,
      pausesSla: payload.pausesSla as boolean | undefined,
      handbackRequested: payload.handbackRequested === true,
      stepCodes: Array.isArray(payload.stepCodes) ? (payload.stepCodes as string[]) : undefined,
      changes: Array.isArray(payload.changes) ? payload.changes.map(reviveCorrection) : undefined,
      id: row.id as string,
      seq: row.seq as number,
      loginId: row.login_id as string | null,
      actingPersonId: row.acting_person_id as string | null,
      text: row.text as string | null,
      payload,
    };
  });
}

/** The `utility_loss` lines of every plant event (ticket 91, 69's R20): the ticket, the machine and its minutes. */
export async function plantEventLines(
  client: Db,
): Promise<{ ticketId: string; machineId: string; minutes: number }[]> {
  const rows = (
    await client.query(
      `SELECT e.ticket_id, e.payload
         FROM ticket_event e
         JOIN ticket t ON t.tenant_id = e.tenant_id AND t.id = e.ticket_id
        WHERE e.type = 'utility_loss' AND t.kind = 'general' AND t.status = 'closed'
        ORDER BY e.ticket_id, e.seq`,
    )
  ).rows;
  return rows.flatMap((row) => {
    const { machineId, minutes } = row.payload as { machineId?: unknown; minutes?: unknown };
    return typeof machineId === 'string' && typeof minutes === 'number'
      ? [{ ticketId: row.ticket_id as string, machineId, minutes }]
      : [];
  });
}
