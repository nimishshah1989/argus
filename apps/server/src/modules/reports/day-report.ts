import type { PoolClient } from 'pg';
import { activePerson, tenantInfo } from '../identity/index.js';
import { shiftsOf } from '../plant/index.js';
import { dayJobRows, pendingRows, type StateAtEnd } from '../tickets/index.js';
import { withMachines } from './machines.js';

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
  /** Hands-on minutes for this person inside the window only: primary plus support. */
  minutes: number;
  primaryMinutes: number;
  supportMinutes: number;
  /** The roles this person worked the ticket in during the window. */
  roles: Array<'primary' | 'support'>;
  closedByPersonId: string | null;
  /** Closed, cancelled or still pending when the window ended: the same judgement as the pending list. */
  stateAtEnd: StateAtEnd;
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
  tenant: ReportTenant;
  person: { id: string; name: string };
  date: string;
  /** The plant's shift code, or null for the whole calendar day. */
  shift: string | null;
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
  shift: string | null;
}

function machineOf(row: Record<string, unknown>): DayReportMachine {
  const snapshot = (row.machine_snapshot ?? {}) as Record<string, string | null>;
  return {
    code: (row.machine_code as string | null) ?? snapshot.code ?? null,
    category: (row.machine_category as string | null) ?? snapshot.category ?? null,
    cell: (row.machine_cell as string | null) ?? snapshot.cell ?? null,
  };
}

/** What the shift table says a shift is: `HH:MM[:SS]` times and whether it ends the next morning. */
interface ShiftTimes {
  start: string;
  end: string;
  endDayOffset: number;
}

const WHOLE_DAY: ShiftTimes = { start: '00:00', end: '00:00', endDayOffset: 1 };

/** The plant's own shift windows; null when the plant has no shift with this code. */
async function shiftTimes(
  client: PoolClient,
  tenantId: string,
  code: string | null,
): Promise<ShiftTimes | null> {
  if (code === null) return WHOLE_DAY;
  const row = (await shiftsOf(client, tenantId)).find((shift) => shift.code === code);
  if (!row) return null;
  return {
    start: row.starts_at as string,
    end: row.ends_at as string,
    endDayOffset: row.crosses_midnight ? 1 : 0,
  };
}

/** Resolve a local window (tenant time zone) into UTC instants. */
async function windowBounds(
  client: PoolClient,
  date: string,
  times: ShiftTimes,
  timeZone: string,
): Promise<{ start: Date; end: Date }> {
  const row = (
    await client.query(
      `SELECT (($1::date + $2::time) AT TIME ZONE $4) AS starts_at,
              ((($1::date + $3::int)::timestamp + $5::time) AT TIME ZONE $4) AS ends_at`,
      [date, times.start, times.endDayOffset, timeZone, times.end],
    )
  ).rows[0];
  return { start: new Date(row.starts_at as string), end: new Date(row.ends_at as string) };
}

export async function queryJobs(
  client: PoolClient,
  tenantId: string,
  personId: string,
  window: { start: Date; end: Date },
): Promise<DayReportJob[]> {
  const rows = await withMachines(
    client,
    tenantId,
    await dayJobRows(client, { tenantId, personId, start: window.start, end: window.end }),
  );
  return rows.map((row) => ({
    ticketId: row.id as string,
    ref: row.ref as string,
    kind: row.kind as string,
    status: row.status as string,
    problem: row.problem as string,
    minutes: row.minutes as number,
    primaryMinutes: row.primary_minutes as number,
    supportMinutes: row.support_minutes as number,
    roles: row.roles as DayReportJob['roles'],
    closedByPersonId: (row.closed_by_person_id as string | null) ?? null,
    stateAtEnd: row.state_at_end as StateAtEnd,
    machine: machineOf(row as Record<string, unknown>),
  }));
}

/** Tickets still pending when the window closed; opened after it are not "pending at end". */
export async function queryPending(
  client: PoolClient,
  tenantId: string,
  windowEnd: Date,
): Promise<DayReportPending[]> {
  const rows = await withMachines(client, tenantId, await pendingRows(client, tenantId, windowEnd));
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

export interface ReportTenant {
  name: string;
  language: string;
  timeZone: string;
}

/** The tenant and the window a report covers; 'no-shift' when the plant has no shift with the asked code. */
export async function resolveWindow(
  client: PoolClient,
  query: { tenantId: string; date: string; shift: string | null },
): Promise<{ tenant: ReportTenant; window: { start: Date; end: Date } } | 'no-shift' | null> {
  const tenant = await tenantInfo(client, query.tenantId);
  if (!tenant) return null;
  const times = await shiftTimes(client, query.tenantId, query.shift);
  if (!times) return 'no-shift';
  const timeZone = tenant.time_zone as string;
  return {
    tenant: { name: tenant.name as string, language: tenant.language as string, timeZone },
    window: await windowBounds(client, query.date, times, timeZone),
  };
}

/**
 * The day report for one person: every ticket they touched in the window (work segments or
 * events), their own hands-on minutes clipped to the window, and the pending-at-end list.
 * Returns null when the person does not exist in the tenant, and 'no-shift' when the plant has no shift with
 * the asked code. The window is the plant's own shift (from the shift table) or the whole calendar day.
 */
export async function loadDayReport(
  client: PoolClient,
  query: DayReportQuery,
): Promise<DayReportData | 'no-shift' | null> {
  const person = await activePerson(client, query.tenantId, query.personId);
  if (!person) return null;
  const resolved = await resolveWindow(client, query);
  if (!resolved || resolved === 'no-shift') return resolved;
  const jobs = await queryJobs(client, query.tenantId, query.personId, resolved.window);
  return {
    tenant: resolved.tenant,
    person: { id: person.id as string, name: person.name as string },
    date: query.date,
    shift: query.shift,
    window: resolved.window,
    jobs,
    totalMinutes: jobs.reduce((sum, job) => sum + job.minutes, 0),
    pending: await queryPending(client, query.tenantId, resolved.window.end),
    generatedAt: new Date(),
  };
}
