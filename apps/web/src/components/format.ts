import { ApiError, type Machine, type Person, type Ticket } from '../api.js';

/** Durations read as `n min`, `h h mm min`, `d d h h` (DOMAIN.md §5, time rules). */
export function formatMinutes(value: number | null | undefined): string {
  if (value == null) return '—';
  const minutes = Math.max(0, Math.round(value));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function elapsedMinutes(iso: string, now: string | number = Date.now()): number {
  const end = typeof now === 'number' ? now : new Date(now).getTime();
  return Math.max(0, Math.floor((end - new Date(iso).getTime()) / 60000));
}

export function elapsedLabel(iso: string, now: string | number = Date.now()): string {
  const minutes = elapsedMinutes(iso, now);
  return minutes < 1 ? 'just now' : `${formatMinutes(minutes)} ago`;
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** A clock time as the close screens show it, e.g. "11:14 AM". */
export function formatClock(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** A plant date and time; `withYear` for a last sign-in, which may be older than this year. */
export function formatDateTime(iso: string, timeZone?: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    ...(withYear ? { year: 'numeric' as const } : {}),
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** The machine's code from the raise-time snapshot, then config, then the work request fields. */
export function machineLabel(ticket: Ticket, machines: Machine[] = []): string {
  const snapshot = ticket.machineSnapshot?.code;
  if (snapshot) return snapshot;
  const machine = machines.find((item) => item.id === ticket.machineId);
  if (machine) return machine.code;
  const location = ticket.location ?? '';
  const workType = ticket.workType ?? '';
  if (location && workType) return `${location} · ${workType}`;
  return location || workType || '—';
}

export function peopleNames(people: Person[] | undefined): Record<string, string> {
  const names: Record<string, string> = {};
  for (const person of people ?? []) names[person.id] = person.name;
  return names;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Could not load. Try again.';
}
