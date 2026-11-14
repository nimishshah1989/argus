import type { PoolClient } from 'pg';
import { peopleByIds } from '../identity/index.js';
import { peopleWhoWorked } from '../tickets/index.js';
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
  primaryMinutes: number;
  supportMinutes: number;
  /** Tickets this person closed (v3: `statusBy` is them) and that were closed when the window ended. */
  closedCount: number;
}

export interface TeamDayReportData {
  tenant: ReportTenant;
  date: string;
  shift: string | null;
  window: { start: Date; end: Date };
  people: TeamMemberDay[];
  /** Different tickets worked by anyone; one ticket two people worked counts once. */
  jobCount: number;
  /** Different tickets that were closed when the window ended (never also in the pending list). */
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
 * The team's day (v3 `/api/dayreport?team=1`, INVENTORY §6.2): everyone who worked a ticket in the window, whatever
 * their team and whether or not they are still active, each with their own minutes split into primary and support,
 * and one pending-at-end list. Returns 'no-shift' when the plant has no shift with the asked code.
 */
export async function loadTeamDayReport(
  client: PoolClient,
  query: TeamDayReportQuery,
): Promise<TeamDayReportData | 'no-shift' | null> {
  const resolved = await resolveWindow(client, query);
  if (!resolved || resolved === 'no-shift') return resolved;
  const ids = await peopleWhoWorked(client, { tenantId: query.tenantId, ...resolved.window });
  const named = await peopleByIds(client, query.tenantId, ids);
  const people: TeamMemberDay[] = [];
  for (const person of named.sort((a, b) => a.name.localeCompare(b.name))) {
    const jobs = await queryJobs(client, query.tenantId, person.id, resolved.window);
    if (jobs.length === 0) continue;
    people.push({
      person: { id: person.id, name: person.name },
      jobs,
      totalMinutes: sum(jobs.map((job) => job.minutes)),
      primaryMinutes: sum(jobs.map((job) => job.primaryMinutes)),
      supportMinutes: sum(jobs.map((job) => job.supportMinutes)),
      closedCount: jobs.filter(
        (job) => job.stateAtEnd === 'closed' && job.closedByPersonId === person.id,
      ).length,
    });
  }
  const tickets = new Map(people.flatMap((row) => row.jobs).map((job) => [job.ticketId, job]));
  return {
    tenant: resolved.tenant,
    date: query.date,
    shift: query.shift,
    window: resolved.window,
    people,
    jobCount: tickets.size,
    closedCount: [...tickets.values()].filter((job) => job.stateAtEnd === 'closed').length,
    totalMinutes: sum(people.map((row) => row.totalMinutes)),
    pending: await queryPending(client, query.tenantId, resolved.window.end),
    generatedAt: new Date(),
  };
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
