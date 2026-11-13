import type { PoolClient } from 'pg';
import type { LoadedEvent } from '../mapper.js';

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

/** Load the ordered event history, including correction and pause snapshots. */
export async function loadEvents(client: PoolClient, ticketId: string): Promise<LoadedEvent[]> {
  const result = await client.query(
    `SELECT seq, type, at, login_id, acting_person_id, text, payload
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
      changes: Array.isArray(payload.changes) ? payload.changes.map(reviveCorrection) : undefined,
      seq: row.seq as number,
      loginId: row.login_id as string | null,
      actingPersonId: row.acting_person_id as string | null,
      text: row.text as string | null,
      payload,
    };
  });
}
