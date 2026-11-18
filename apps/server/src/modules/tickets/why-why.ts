import type { PoolClient } from 'pg';
import { whyWhyPayloadSchema, type WhyWhyPayload, type WhyWhyWrite } from '@uptimo/shared';
import { plantToday } from '../plant/index.js';
import { appendWhyWhyEvent, latestWhyWhy, whyWhyTicket, type WhyWhyTicket } from './repo/events.js';

/** R3's named refusals: each message names the permission, not a generic refusal. */
export const WHY_WHY_READ_REFUSAL = 'You do not have permission to read a Why-Why';
export const WHY_WHY_WRITE_REFUSAL =
  'Only a supervisor, head, plant head or admin may save a Why-Why';

/** Where a ticket stands for the Why-Why routes. */
export type WhyWhyState = 'ok' | 'missing' | 'not-breakdown';

/** The plan's guard: the ticket must exist in the tenant and be a closed breakdown, else 404 or 409. */
export async function whyWhyState(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<WhyWhyState> {
  const ticket: WhyWhyTicket | null = await whyWhyTicket(client, tenantId, ticketId);
  if (!ticket) return 'missing';
  return ticket.kind === 'stopped' && ticket.status === 'closed' ? 'ok' : 'not-breakdown';
}

/** The latest saved record, or null when the ticket has none yet. */
export async function loadWhyWhy(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<WhyWhyPayload | null> {
  return latestWhyWhy(client, tenantId, ticketId);
}

export interface SaveWhyWhyInput {
  tenantId: string;
  ticketId: string;
  loginId: string;
  /** The acting person's id, never one a body names. */
  personId: string;
  body: WhyWhyWrite;
  /** The plant clock's instant: the same now dates the event and the record. */
  now: Date;
}

/**
 * Appends one record as the acting person on the plant's own day (R2/R3). The author and date are derived here,
 * so no body field can set them; null when the ticket is no longer a closed breakdown.
 */
export async function saveWhyWhy(
  client: PoolClient,
  input: SaveWhyWhyInput,
): Promise<WhyWhyPayload | null> {
  const record = whyWhyPayloadSchema.parse({
    ...input.body,
    completedBy: input.personId,
    completedDate: await plantToday(client, input.tenantId, input.now),
  });
  const event = await appendWhyWhyEvent(client, {
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    at: input.now,
    loginId: input.loginId,
    actingPersonId: input.personId,
    payload: record,
  });
  return event ? record : null;
}
