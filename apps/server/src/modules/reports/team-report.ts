import type { PoolClient } from 'pg';
import { activePeople } from '../identity/index.js';
import {
  queryJobs,
  queryPending,
  resolveWindow,
  type DayReportJob,
  type DayReportPending,
  type ReportTenant,
} from './day-report.js';

export interface TeamMemberDay {
  person: { id: string; name: string };
  jobs: DayReportJob[];
  /** This person's own minutes in the window: the same number their own day report shows. */
  totalMinutes: number;
}

export interface TeamDayReportData {
  tenant: ReportTenant;
  date: string;
  shift: string | null;
  window: { start: Date; end: Date };
  people: TeamMemberDay[];
  /** Different tickets worked by anyone on the team; one ticket two people worked counts once. */
  jobCount: number;
  closedCount: number;
  totalMinutes: number;
  pending: DayReportPending[];
  generatedAt: Date;
}

export interface TeamDayReportQuery {
  tenantId: string;
  date: string;
  shift: string | null;
}

/**
 * The team's day (v3 `/api/dayreport?team=1`, INVENTORY §6.2): every active maintenance-team person who worked a
 * ticket in the window, each with their own minutes, and one pending-at-end list. Returns 'no-shift' when the plant
 * has no shift with the asked code.
 */
export async function loadTeamDayReport(
  client: PoolClient,
  query: TeamDayReportQuery,
): Promise<TeamDayReportData | 'no-shift' | null> {
  const resolved = await resolveWindow(client, query);
  if (!resolved || resolved === 'no-shift') return resolved;
  const people: TeamMemberDay[] = [];
  for (const person of await activePeople(client, query.tenantId)) {
    if (person.team !== 'maintenance') continue;
    const jobs = await queryJobs(client, query.tenantId, person.id, resolved.window);
    if (jobs.length === 0) continue;
    const totalMinutes = jobs.reduce((sum, job) => sum + job.minutes, 0);
    people.push({ person: { id: person.id, name: person.name }, jobs, totalMinutes });
  }
  const tickets = new Map(people.flatMap((row) => row.jobs).map((job) => [job.ticketId, job]));
  return {
    tenant: resolved.tenant,
    date: query.date,
    shift: query.shift,
    window: resolved.window,
    people,
    jobCount: tickets.size,
    closedCount: [...tickets.values()].filter((job) => job.status === 'closed').length,
    totalMinutes: people.reduce((sum, row) => sum + row.totalMinutes, 0),
    pending: await queryPending(client, query.tenantId, resolved.window.end),
    generatedAt: new Date(),
  };
}
