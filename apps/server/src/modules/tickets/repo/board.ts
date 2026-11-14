import type { PoolClient, QueryResult } from 'pg';
import { TICKET_COLUMNS } from './ticket.js';

type Db = Pick<PoolClient, 'query'>;

export interface DayWindow {
  from: Date;
  to: Date;
}

/** The calendar day `now` falls in, in the plant's time zone, as instants: from midnight (inclusive) to the next (exclusive). */
export async function dayWindow(tx: Db, timeZone: string, now: Date): Promise<DayWindow> {
  const row = (
    await tx.query(
      `WITH local AS (SELECT date_trunc('day', $1::timestamptz AT TIME ZONE $2) AS day)
       SELECT day AT TIME ZONE $2 AS from_at, (day + interval '1 day') AT TIME ZONE $2 AS to_at FROM local`,
      [now, timeZone],
    )
  ).rows[0];
  return { from: new Date(row.from_at as string), to: new Date(row.to_at as string) };
}

/**
 * The day's breakdowns, whatever their status (the caller leaves the cancelled out): stopped tickets reported in the
 * window, closed in it, or still open now with any report date. Follow-up task rows (a parent) are not breakdowns.
 * One query; the `closed_at` half has no index yet (a `(tenant_id, closed_at)` index belongs to the next migration batch).
 */
export async function dayTicketRows(
  tx: Db,
  tenantId: string,
  window: DayWindow,
): Promise<QueryResult['rows']> {
  return (
    await tx.query(
      `SELECT ${TICKET_COLUMNS} FROM ticket
       WHERE tenant_id = $1 AND kind = 'stopped' AND parent_id IS NULL
         AND ((reported_at >= $2 AND reported_at < $3)
           OR (status = 'closed' AND closed_at >= $2 AND closed_at < $3 AND reported_at < $3)
           OR status IN ('open', 'working', 'waiting'))
       ORDER BY reported_at`,
      [tenantId, window.from, window.to],
    )
  ).rows;
}
