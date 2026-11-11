import type { Ticket } from '../../api.js';

const HOUR_MS = 60 * 60 * 1000;

export const CANCELLED_WINDOW_MS = 24 * HOUR_MS;
export const CLOSED_WINDOW_MS = 30 * 24 * HOUR_MS;

/** Pure window + aggregation helpers behind the desk Team/Mine views (tested in views.test.ts). */

function toMs(now: string | number): number {
  return typeof now === 'number' ? now : new Date(now).getTime();
}

/**
 * Cancelled tickets carry no cancelled-at field, so use the best timestamp there is:
 * closedAt (a correct/restore can close one), else startedAt, else reportedAt.
 */
export function ticketTime(ticket: Ticket): number {
  const iso = ticket.closedAt ?? ticket.startedAt ?? ticket.reportedAt;
  return new Date(iso).getTime();
}

function withinWindow(tickets: Ticket[], windowMs: number, now: string | number): Ticket[] {
  const start = toMs(now) - windowMs;
  return tickets
    .filter((ticket) => ticketTime(ticket) >= start)
    .sort((a, b) => ticketTime(b) - ticketTime(a));
}

export function cancelledLast24h(tickets: Ticket[], now: string | number = Date.now()): Ticket[] {
  return withinWindow(
    tickets.filter((ticket) => ticket.status === 'cancelled'),
    CANCELLED_WINDOW_MS,
    now,
  );
}

export function closedLast30Days(tickets: Ticket[], now: string | number = Date.now()): Ticket[] {
  return withinWindow(
    tickets.filter((ticket) => ticket.status === 'closed'),
    CLOSED_WINDOW_MS,
    now,
  );
}

export interface WorkingGroup {
  personId: string;
  tickets: Ticket[];
  minutes: number;
}

/** Working now, grouped by the lead: who is on what, with their hands-on minutes. */
export function workingByPerson(tickets: Ticket[]): WorkingGroup[] {
  const groups = new Map<string, WorkingGroup>();
  for (const ticket of tickets) {
    if (ticket.status !== 'working' || !ticket.leadPersonId) continue;
    const personId = ticket.leadPersonId;
    const group = groups.get(personId) ?? { personId, tickets: [], minutes: 0 };
    group.tickets.push(ticket);
    group.minutes += ticket.figures?.activeMin ?? 0;
    groups.set(personId, group);
  }
  return [...groups.values()].sort((a, b) => b.minutes - a.minutes);
}

export interface PersonTotal {
  personId: string;
  primary: number;
  support: number;
}

export interface MonthTotals {
  month: string;
  rows: PersonTotal[];
  primary: number;
  support: number;
}

function addMinutes(target: PersonTotal, primary: number, support: number): PersonTotal {
  return { ...target, primary: target.primary + primary, support: target.support + support };
}

function personRow(month: Map<string, PersonTotal>, personId: string): PersonTotal {
  return month.get(personId) ?? { personId, primary: 0, support: 0 };
}

function addTicket(people: Map<string, PersonTotal>, ticket: Ticket): void {
  const perPerson = Object.entries(ticket.figures?.perPerson ?? {});
  if (perPerson.length === 0) {
    if (!ticket.leadPersonId) return;
    const personId = ticket.leadPersonId;
    people.set(
      personId,
      addMinutes(personRow(people, personId), ticket.figures?.activeMin ?? 0, 0),
    );
    return;
  }
  for (const [personId, minutes] of perPerson) {
    const primary = personId === ticket.leadPersonId ? minutes : 0;
    people.set(personId, addMinutes(personRow(people, personId), primary, minutes - primary));
  }
}

function monthTotals(month: string, people: Map<string, PersonTotal>): MonthTotals {
  const rows = [...people.values()].sort((a, b) => b.primary + b.support - (a.primary + a.support));
  return {
    month,
    rows,
    primary: rows.reduce((sum, row) => sum + row.primary, 0),
    support: rows.reduce((sum, row) => sum + row.support, 0),
  };
}

/**
 * Monthly totals per person from the 30-day closed list. The list projection has no
 * `figures.perPerson`, so the fallback books the lead's hands-on minute total as primary;
 * when a payload does carry perPerson, the lead's share is primary and the rest is support.
 */
export function monthlyTotals(tickets: Ticket[]): MonthTotals[] {
  const months = new Map<string, Map<string, PersonTotal>>();
  for (const ticket of tickets) {
    if (ticket.status !== 'closed' || !ticket.closedAt) continue;
    const month = ticket.closedAt.slice(0, 7);
    const people = months.get(month) ?? new Map<string, PersonTotal>();
    addTicket(people, ticket);
    months.set(month, people);
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, people]) => monthTotals(month, people));
}

/** The date the day report is for: the desk's local calendar day. */
export function todayDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayReportHref(date: string = todayDate()): string {
  return `/api/v1/reports/day.pdf?date=${encodeURIComponent(date)}`;
}
