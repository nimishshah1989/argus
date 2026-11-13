import type { PoolClient } from 'pg';
import { activePerson, tenantInfo } from '../identity/index.js';
import { withMachines } from './machines.js';

export type DayShift = 'day' | 'night';

/**
 * Shift windows for day reports. The real pattern is still open (NEEDS N11,
 * docs/plan/NEEDS.md): two windows or three shifts, and which shift owns the 18:29–18:30
 * overlap. Every window definition lives here until N11 closes — do not scatter them.
 */
export const SHIFT_WINDOWS: Record<DayShift, { start: string; end: string; endDayOffset: number }> =
  {
    day: { start: '08:00', end: '18:30', endDayOffset: 0 },
    night: { start: '18:29', end: '05:00', endDayOffset: 1 },
  };

export interface DayReportMachine {
  code: string | null;
  category: string | null;
  cell: string | null;
}

export interface DayReportJob {
  ticketId: string;
  ref: string;
  kind: string;
  status: string;
  problem: string;
  /** Hands-on minutes for this person inside the window only. */
  minutes: number;
  machine: DayReportMachine;
}

export interface DayReportPending {
  ticketId: string;
  ref: string;
  kind: string;
  status: string;
  problem: string;
  reportedAt: Date;
  machine: DayReportMachine;
}

export interface DayReportData {
  tenant: { name: string; language: string; timeZone: string };
  person: { id: string; name: string };
  date: string;
  shift: DayShift;
  window: { start: Date; end: Date };
  jobs: DayReportJob[];
  totalMinutes: number;
  pending: DayReportPending[];
  generatedAt: Date;
}

export interface DayReportQuery {
  tenantId: string;
  personId: string;
  date: string;
  shift: DayShift;
}

function machineOf(row: Record<string, unknown>): DayReportMachine {
  const snapshot = (row.machine_snapshot ?? {}) as Record<string, string | null>;
  return {
    code: (row.machine_code as string | null) ?? snapshot.code ?? null,
    category: (row.machine_category as string | null) ?? snapshot.category ?? null,
    cell: (row.machine_cell as string | null) ?? snapshot.cell ?? null,
  };
}

/** Resolve a local shift window (tenant time zone) into UTC instants. */
async function windowBounds(
  client: PoolClient,
  date: string,
  shift: DayShift,
  timeZone: string,
): Promise<{ start: Date; end: Date }> {
  const spec = SHIFT_WINDOWS[shift];
  const row = (
    await client.query(
      `SELECT (($1::date + $2::time) AT TIME ZONE $4) AS starts_at,
              ((($1::date + $3::int)::timestamp + $5::time) AT TIME ZONE $4) AS ends_at`,
      [date, spec.start, spec.endDayOffset, timeZone, spec.end],
    )
  ).rows[0];
  return { start: new Date(row.starts_at as string), end: new Date(row.ends_at as string) };
}

const JOBS_SQL = `WITH touched AS (
    SELECT ticket_id FROM work_segment
     WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4
       AND COALESCE(ended_at, $4) > $3
    UNION
    SELECT ticket_id FROM ticket_event
     WHERE tenant_id = $1 AND acting_person_id = $2 AND at >= $3 AND at < $4
  ), minutes AS (
    SELECT ticket_id,
           SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, $4), $4) - GREATEST(started_at, $3))) / 60)::int
             AS mins
      FROM work_segment
     WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4
       AND COALESCE(ended_at, $4) > $3
     GROUP BY ticket_id
  )
  SELECT t.id, t.ref, t.kind, t.status, t.problem, t.machine_snapshot, t.machine_id,
         COALESCE(minutes.mins, 0) AS minutes
    FROM touched
    JOIN ticket t ON t.id = touched.ticket_id AND t.tenant_id = $1
    LEFT JOIN minutes ON minutes.ticket_id = t.id
   ORDER BY t.reported_at, t.ref`;

async function queryJobs(
  client: PoolClient,
  tenantId: string,
  personId: string,
  window: { start: Date; end: Date },
): Promise<DayReportJob[]> {
  const rows = await withMachines(
    client,
    tenantId,
    (await client.query(JOBS_SQL, [tenantId, personId, window.start, window.end])).rows,
  );
  return rows.map((row) => ({
    ticketId: row.id as string,
    ref: row.ref as string,
    kind: row.kind as string,
    status: row.status as string,
    problem: row.problem as string,
    minutes: row.minutes as number,
    machine: machineOf(row as Record<string, unknown>),
  }));
}

const PENDING_SQL = `SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.machine_snapshot, t.machine_id
    FROM ticket t
   WHERE t.tenant_id = $1 AND t.status IN ('open', 'working', 'waiting') AND t.reported_at < $2
   ORDER BY t.reported_at, t.ref`;

/** Tickets still pending when the window closed; opened after it are not "pending at end". */
async function queryPending(
  client: PoolClient,
  tenantId: string,
  windowEnd: Date,
): Promise<DayReportPending[]> {
  const rows = await withMachines(
    client,
    tenantId,
    (await client.query(PENDING_SQL, [tenantId, windowEnd])).rows,
  );
  return rows.map((row) => ({
    ticketId: row.id as string,
    ref: row.ref as string,
    kind: row.kind as string,
    status: row.status as string,
    problem: row.problem as string,
    reportedAt: new Date(row.reported_at as string),
    machine: machineOf(row as Record<string, unknown>),
  }));
}

/**
 * The day report for one person: every ticket they touched in the window (work segments or
 * events), their own hands-on minutes clipped to the window, and the pending-at-end list.
 * Returns null when the person does not exist in the tenant.
 */
export async function loadDayReport(
  client: PoolClient,
  query: DayReportQuery,
): Promise<DayReportData | null> {
  const tenant = await tenantInfo(client, query.tenantId);
  if (!tenant) return null;
  const person = await activePerson(client, query.tenantId, query.personId);
  if (!person) return null;
  const window = await windowBounds(client, query.date, query.shift, tenant.time_zone as string);
  const jobs = await queryJobs(client, query.tenantId, query.personId, window);
  return {
    tenant: {
      name: tenant.name as string,
      language: tenant.language as string,
      timeZone: tenant.time_zone as string,
    },
    person: { id: person.id as string, name: person.name as string },
    date: query.date,
    shift: query.shift,
    window,
    jobs,
    totalMinutes: jobs.reduce((sum, job) => sum + job.minutes, 0),
    pending: await queryPending(client, query.tenantId, window.end),
    generatedAt: new Date(),
  };
}
