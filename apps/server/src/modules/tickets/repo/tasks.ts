import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

/** Today's date in the plant's time zone, `YYYY-MM-DD`: a task is overdue once its expected date is before it. */
export async function plantToday(tx: Db, timeZone: string): Promise<string> {
  const row = (
    await tx.query("SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS today", [timeZone])
  ).rows[0];
  return row.today as string;
}

/** Points a freshly raised ticket back at the breakdown it was left from. */
export async function linkTask(
  tx: Db,
  link: { ticketId: string; parentId: string; reasonCode: string; expectedOn: string | null },
): Promise<void> {
  await tx.query(
    'UPDATE ticket SET parent_id = $2, task_reason = $3, task_expected_on = $4 WHERE id = $1',
    [link.ticketId, link.parentId, link.reasonCode, link.expectedOn],
  );
}

/**
 * Writes a `task` line on the parent's history, numbered after what it already holds. The parent is locked for the
 * numbering, so two tasks closing at once cannot take the same number. Returns the new last sequence number.
 */
export async function appendParentEvent(
  tx: Db,
  line: {
    tenantId: string;
    parentId: string;
    key: string;
    at: Date;
    loginId: string;
    actingPersonId: string | null;
    text: string;
    reasonCode: string | null;
    task: Record<string, unknown>;
  },
): Promise<number> {
  const seq =
    Number(
      (
        await tx.query(
          'SELECT last_event_seq FROM ticket WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [line.parentId, line.tenantId],
        )
      ).rows[0].last_event_seq,
    ) + 1;
  await tx.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, idempotency_key, at, login_id, acting_person_id, text, payload)
     VALUES ($1, $2, $3, 'task', $4, $5, $6, $7, $8, $9)`,
    [
      line.tenantId,
      line.parentId,
      seq,
      line.key,
      line.at,
      line.loginId,
      line.actingPersonId,
      line.text,
      JSON.stringify({ reason: line.reasonCode, task: line.task }),
    ],
  );
  await tx.query('UPDATE ticket SET last_event_seq = $2 WHERE id = $1', [line.parentId, seq]);
  return seq;
}

/** The tasks left from a ticket, oldest reference first; cancelled ones are not part of the follow-up. */
export async function taskRowsOf(tx: Db, tenantId: string, parentId: string): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT id, ref, status, problem, task_reason, task_expected_on::text AS task_expected_on, task_down_min,
              lead_person_id, closed_at, closed_by_person_id
         FROM ticket WHERE tenant_id = $1 AND parent_id = $2 AND status <> 'cancelled' ORDER BY ref`,
      [tenantId, parentId],
    )
  ).rows;
}

export async function parentOf(
  tx: Db,
  tenantId: string,
  parentId: string | null,
): Promise<{ id: string; ref: string } | null> {
  if (!parentId) return null;
  const row = (
    await tx.query('SELECT id, ref FROM ticket WHERE id = $1 AND tenant_id = $2', [
      parentId,
      tenantId,
    ])
  ).rows[0];
  return row ? { id: row.id as string, ref: row.ref as string } : null;
}
