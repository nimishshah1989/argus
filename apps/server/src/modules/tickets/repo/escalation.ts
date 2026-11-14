import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface DownFacts {
  status: string;
  kind: 'stopped' | 'support' | 'general';
  severity: string;
  /** When the machine last stopped: the report, the upgrade to a breakdown, or the stop after a running spell. */
  downSince: Date;
  machineRunning: boolean;
}

/** What "a critical machine still down" reads: the ticket's state, its severity and when the machine last went down. */
export async function ticketDownFacts(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<DownFacts | null> {
  const row = (
    await tx.query(
      `SELECT status, kind, severity, machine_running_at, machine_stopped_at,
              COALESCE(machine_stopped_at, kind_upgraded_at, reported_at) AS down_since
         FROM ticket WHERE tenant_id = $1 AND id = $2 AND raised_channel <> 'backfill'`,
      [tenantId, ticketId],
    )
  ).rows[0];
  if (!row) return null;
  return {
    status: row.status,
    kind: row.kind,
    severity: row.severity,
    downSince: row.down_since,
    machineRunning: row.machine_running_at !== null && row.machine_stopped_at === null,
  };
}

export interface EscalationEventInput {
  tenantId: string;
  ticketId: string;
  at: Date;
  /** One key per step: the table refuses a second event with it, so a step can never be written twice. */
  key: string;
  escalation: Record<string, unknown>;
}

/** Whether this step already has its history event. */
export async function escalationStepDone(tx: Db, ticketId: string, key: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    'SELECT 1 FROM ticket_event WHERE ticket_id = $1 AND idempotency_key = $2',
    [ticketId, key],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Writes the history event of one escalation step, by the system (no login, no acting person), as the ticket's next
 * event. The caller holds the ticket lock. Returns the event id, or null when this step's event is already there.
 */
export async function appendEscalationEvent(
  tx: Db,
  input: EscalationEventInput,
): Promise<string | null> {
  if (await escalationStepDone(tx, input.ticketId, input.key)) return null;
  const seq = (
    await tx.query(
      `UPDATE ticket SET last_event_seq = GREATEST(last_event_seq,
         (SELECT COALESCE(MAX(seq), -1) FROM ticket_event WHERE ticket_id = $2)) + 1
       WHERE tenant_id = $1 AND id = $2 RETURNING last_event_seq`,
      [input.tenantId, input.ticketId],
    )
  ).rows[0]?.last_event_seq as number | undefined;
  if (seq === undefined) return null;
  const { rows } = await tx.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, idempotency_key, at, payload)
     VALUES ($1, $2, $3, 'escalate', $4, $5, $6) RETURNING id`,
    [
      input.tenantId,
      input.ticketId,
      seq,
      input.key,
      input.at,
      JSON.stringify({ escalation: input.escalation }),
    ],
  );
  return rows[0].id as string;
}
