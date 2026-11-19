import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * The machines that already have a PM job open, being worked or waiting (R6's idempotency: one job per plan and
 * period). Database reads only; `pm.generate` owns the decision and the raise.
 */
export async function openPmMachineIds(
  tx: Db,
  tenantId: string,
  machineIds: readonly string[],
): Promise<Set<string>> {
  if (machineIds.length === 0) return new Set();
  const rows = (
    await tx.query(
      `SELECT DISTINCT machine_id FROM ticket
        WHERE tenant_id = $1 AND raised_channel = 'pm'
          AND status IN ('open', 'working', 'waiting') AND machine_id = ANY($2::uuid[])`,
      [tenantId, machineIds],
    )
  ).rows;
  return new Set(rows.map((row) => row.machine_id as string));
}

/**
 * The meter reading of each machine's most recent closed PM job: the baseline R6 measures the plan's
 * `last_meter_reading` against. The most recent report always wins; it carries no numeric `readings.meter`
 * (a non-meter plan, or a report written by hand), the plan has no baseline and the meter rule stays inert.
 */
export async function latestPmReadings(
  tx: Db,
  tenantId: string,
  machineIds: readonly string[],
): Promise<Map<string, number>> {
  const readings = new Map<string, number>();
  if (machineIds.length === 0) return readings;
  const rows = (
    await tx.query(
      `SELECT DISTINCT ON (t.machine_id) t.machine_id,
              CASE WHEN jsonb_typeof(r.pm_report->'readings'->'meter') = 'number'
                   THEN (r.pm_report->'readings'->>'meter')::float8 END AS meter
         FROM ticket t
         JOIN breakdown_report r ON r.tenant_id = t.tenant_id AND r.ticket_id = t.id
        WHERE t.tenant_id = $1 AND t.raised_channel = 'pm' AND t.status = 'closed'
          AND t.machine_id = ANY($2::uuid[])
        ORDER BY t.machine_id, t.closed_at DESC NULLS LAST`,
      [tenantId, machineIds],
    )
  ).rows;
  for (const row of rows)
    if (row.meter !== null) readings.set(row.machine_id as string, Number(row.meter));
  return readings;
}

/** An open PM ticket as the calendar reads it: its scheduled date plus what a move must not touch. */
export interface PmCalendarTicketRow {
  ticketId: string;
  machineId: string;
  ref: string;
  title: string;
  status: string;
  /** `task_expected_on`, or null when the job has no scheduled date (the mapper falls back to `reported_at`). */
  scheduledOn: string | null;
  reportedAt: Date;
  startedAt: Date | null;
}

/**
 * The open PM jobs of one plant (R2): they replace their machine's plan occurrence. One row per job, oldest
 * first, so a machine with more than one (a bad import) keeps a deterministic first one in the pure calendar.
 */
export async function pmTicketsForCalendar(
  tx: Db,
  tenantId: string,
): Promise<PmCalendarTicketRow[]> {
  const rows = (
    await tx.query(
      `SELECT id, machine_id, ref, problem, status, task_expected_on::text AS task_expected_on,
              reported_at, started_at
         FROM ticket
        WHERE tenant_id = $1 AND raised_channel = 'pm' AND parent_id IS NULL
          AND status IN ('open', 'working', 'waiting')
        ORDER BY reported_at, id`,
      [tenantId],
    )
  ).rows;
  return rows.map((row) => ({
    ticketId: row.id as string,
    machineId: row.machine_id as string,
    ref: row.ref as string,
    title: row.problem as string,
    status: row.status as string,
    scheduledOn: (row.task_expected_on as string | null) ?? null,
    reportedAt: new Date(row.reported_at as string | number | Date),
    startedAt: row.started_at === null ? null : new Date(row.started_at as string | number | Date),
  }));
}

export interface PmScheduleMove {
  ticketId: string;
  /** The scheduled day before the move, for the audit line. */
  from: string;
  to: string;
  /** The effective plan the window came from, when the machine still has one. */
  planId: string | null;
  loginId: string | null;
  actingPersonId: string | null;
}

/**
 * Moves one open PM job to another day (R3): `task_expected_on`, `updated_at` and one `update` event with the
 * from/to dates; `reported_at`, `started_at` and every `pm_plan` row stay untouched. The UPDATE's status/started
 * guard makes a started job a refusal even if another request raced in; null means "no longer movable".
 */
export async function setPmScheduledOn(
  tx: Db,
  tenantId: string,
  move: PmScheduleMove,
): Promise<{ ref: string; seq: number } | null> {
  const moved = (
    await tx.query(
      `UPDATE ticket SET
         task_expected_on = $3,
         updated_at = now(),
         last_event_seq = GREATEST(last_event_seq,
           (SELECT COALESCE(MAX(seq), -1) FROM ticket_event
             WHERE tenant_id = $1 AND ticket_id = $2)) + 1
       WHERE tenant_id = $1 AND id = $2 AND raised_channel = 'pm' AND parent_id IS NULL
         AND status = 'open' AND started_at IS NULL
       RETURNING ref, last_event_seq`,
      [tenantId, move.ticketId, move.to],
    )
  ).rows[0];
  if (!moved) return null;
  await tx.query(
    `INSERT INTO ticket_event
       (tenant_id, ticket_id, seq, type, at, login_id, acting_person_id, payload)
     VALUES ($1, $2, $3, 'update', now(), $4, $5, $6)`,
    [
      tenantId,
      move.ticketId,
      moved.last_event_seq,
      move.loginId,
      move.actingPersonId,
      JSON.stringify({
        changes: [{ field: 'scheduledOn', from: move.from, to: move.to }],
        planId: move.planId,
      }),
    ],
  );
  return { ref: moved.ref as string, seq: moved.last_event_seq as number };
}

/** One closed PM job's stored report, as the workbook's PM Reports sheet prints it (50b, R15). */
export interface PmExportReportRow {
  ticketId: string;
  machineId: string;
  closedAt: Date;
  /** The job's scheduled day (`task_expected_on`), when it had one. */
  scheduledOn: string | null;
  /** The stored `pm_report` object; its shape is the close's (`pmReportSchema`). */
  report: unknown;
}

/**
 * The closed PM jobs that carry a stored report (ticket 50b, R15): the live PM Reports sheet's rows, one per job.
 * A mark-done close stores no `pm_report` and is not a report row; the machine's code is the caller's lookup so
 * this repo never names the plant's table (boundaries).
 */
export async function pmReportsForExport(tx: Db, tenantId: string): Promise<PmExportReportRow[]> {
  const rows = (
    await tx.query(
      `SELECT t.id, t.machine_id, t.closed_at, t.task_expected_on::text AS task_expected_on, r.pm_report
         FROM ticket t
         JOIN breakdown_report r ON r.tenant_id = t.tenant_id AND r.ticket_id = t.id
        WHERE t.tenant_id = $1 AND t.raised_channel = 'pm' AND t.parent_id IS NULL
          AND t.status = 'closed' AND r.pm_report IS NOT NULL
        ORDER BY t.closed_at, t.id`,
      [tenantId],
    )
  ).rows;
  return rows.map((row) => ({
    ticketId: row.id as string,
    machineId: row.machine_id as string,
    closedAt: new Date(row.closed_at as string | number | Date),
    scheduledOn: (row.task_expected_on as string | null) ?? null,
    report: row.pm_report,
  }));
}
