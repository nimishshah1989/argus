import type { Machine, Person, Ticket } from '../../api.js';

/** The Open screen's lists and counts, ported from v3's `vOpen()` (sort rules and filters as he has them). */

export type Chip = 'down' | 'waiting' | 'support';
export type ChipFilter = Chip | 'running' | '';

const BREAKDOWN_ACTIVE = new Set(['open', 'waiting']);
const time = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** A running machine with its ticket still open is a follow-up (v3 `isFollow`). */
export function isFollow(ticket: Ticket): boolean {
  return (
    ticket.kind === 'stopped' &&
    ticket.machineRunningAt !== null &&
    ['open', 'working', 'waiting'].includes(ticket.status)
  );
}

export function chipOf(ticket: Ticket): Chip {
  if (ticket.status === 'waiting') return 'waiting';
  return isFollow(ticket) || ticket.kind === 'support' ? 'support' : 'down';
}

export interface OpenCounts {
  down: number;
  waiting: number;
  support: number;
  running: number;
}

/** Machines down, waiting, needing support, and the rest running (a machine with no open ticket). */
export function openCounts(open: Ticket[], machines: Machine[]): OpenCounts {
  const ids = new Set(machines.map((machine) => machine.id));
  const onMachine = open.filter(
    (ticket) => ticket.kind !== 'general' && ticket.machineId && ids.has(ticket.machineId),
  );
  const counts = { down: 0, waiting: 0, support: 0 };
  for (const ticket of onMachine) counts[chipOf(ticket)] += 1;
  return { ...counts, running: Math.max(0, ids.size - onMachine.length) };
}

const byReported = (a: Ticket, b: Ticket): number => time(a.reportedAt) - time(b.reportedAt);
const passes = (filter: ChipFilter) => (ticket: Ticket) =>
  filter === '' || filter === 'running' || chipOf(ticket) === filter;

/** Open breakdowns nobody has started: stopped first, longest wait first. */
export function notStarted(open: Ticket[], filter: ChipFilter): Ticket[] {
  return open
    .filter((t) => t.status === 'open' && t.kind !== 'general' && passes(filter)(t))
    .sort((a, b) => (a.kind === b.kind ? byReported(a, b) : a.kind === 'stopped' ? -1 : 1));
}

/** Paused breakdowns, the ones waiting longest first. */
export function pausedBreakdowns(open: Ticket[], filter: ChipFilter): Ticket[] {
  return open
    .filter((t) => t.status === 'waiting' && t.kind !== 'general' && passes(filter)(t))
    .sort((a, b) => time(a.waitSince) - time(b.waitSince));
}

/** Pending tasks left after a close: earliest expected date first, then oldest. */
export function pendingTasks(open: Ticket[]): Ticket[] {
  return open
    .filter((t) => t.kind === 'general' && t.parentId && BREAKDOWN_ACTIVE.has(t.status))
    .sort(
      (a, b) =>
        (a.taskExpectedOn ?? '9').localeCompare(b.taskExpectedOn ?? '9') || byReported(a, b),
    );
}

/** Work requests not on a machine: urgent first, then oldest. */
export function workRequests(open: Ticket[]): Ticket[] {
  return open
    .filter((t) => t.status === 'open' && t.kind === 'general' && !t.parentId)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || byReported(a, b));
}

export function breakdownCount(open: Ticket[]): number {
  return open.filter((t) => t.kind !== 'general' && BREAKDOWN_ACTIVE.has(t.status)).length;
}

function minutesSince(iso: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(iso)) / 60000));
}

/** v3 `downNow`: the finished stopped stretches plus the one still open (none while the machine runs). */
export function downNow(ticket: Ticket, now: string): number {
  const open = ticket.machineRunningAt
    ? 0
    : minutesSince(ticket.machineStoppedAt ?? ticket.reportedAt, now);
  return (ticket.figures?.downAccMin ?? 0) + open;
}

export interface TimeLine {
  key:
    | 'deskLists.time.down'
    | 'deskLists.time.open'
    | 'deskLists.time.waiting'
    | 'deskLists.time.follow';
  minutes: number;
  /** Follow-up only: when the machine ran again. */
  since?: string;
}

/** The coloured "Down 25 min" line on a card (v3 `tkCard`). */
export function timeLine(ticket: Ticket, now: string): TimeLine {
  const stopped = ticket.kind === 'stopped';
  const minutes = stopped ? downNow(ticket, now) : minutesSince(ticket.reportedAt, now);
  if (isFollow(ticket) && ticket.machineRunningAt)
    return { key: 'deskLists.time.follow', minutes, since: ticket.machineRunningAt };
  if (ticket.status === 'waiting')
    return { key: stopped ? 'deskLists.time.down' : 'deskLists.time.open', minutes };
  if (ticket.handedOver && stopped) return { key: 'deskLists.time.down', minutes };
  if (ticket.kind === 'general' || ticket.kind === 'support')
    return { key: 'deskLists.time.open', minutes };
  return { key: 'deskLists.time.waiting', minutes };
}

export interface TeamRow {
  person: Person;
  ticket: Ticket;
  paused: boolean;
  minutes: number;
}

/** Who is on a job right now: the lead of every working or paused ticket, nobody listed as free. */
export function teamNow(open: Ticket[], people: Person[] | undefined): TeamRow[] {
  const rows: TeamRow[] = [];
  for (const ticket of open) {
    if (ticket.status !== 'working' && ticket.status !== 'waiting') continue;
    const person = people?.find((candidate) => candidate.id === ticket.leadPersonId);
    if (person)
      rows.push({
        person,
        ticket,
        paused: ticket.status === 'waiting',
        minutes: ticket.figures?.activeMin ?? 0,
      });
  }
  return rows;
}

export interface TypeLine {
  key:
    | 'deskLists.type.stopped'
    | 'deskLists.type.follow'
    | 'deskLists.type.support'
    | 'deskLists.type.work'
    | 'deskLists.type.task'
    | 'deskLists.type.taskExpected';
  /** Text colour token: stopped red, running green, support amber, work and tasks neutral. */
  tone: 'text-stopped' | 'text-running' | 'text-waiting' | 'text-in-progress';
  date?: string;
}

/** The line under the ref on a card that says what kind of job it is (v3 `typeLine`). */
export function typeLine(ticket: Ticket): TypeLine {
  if (ticket.parentId) {
    return ticket.taskExpectedOn
      ? {
          key: 'deskLists.type.taskExpected',
          tone: 'text-in-progress',
          date: ticket.taskExpectedOn,
        }
      : { key: 'deskLists.type.task', tone: 'text-in-progress' };
  }
  if (ticket.kind === 'stopped')
    return ticket.machineRunningAt
      ? { key: 'deskLists.type.follow', tone: 'text-running' }
      : { key: 'deskLists.type.stopped', tone: 'text-stopped' };
  if (ticket.kind === 'support') return { key: 'deskLists.type.support', tone: 'text-waiting' };
  return { key: 'deskLists.type.work', tone: 'text-in-progress' };
}
