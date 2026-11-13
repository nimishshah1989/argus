import {
  addBusinessMinutes,
  businessMinutesBetween,
  SlaInputError,
  type BusinessCalendar,
} from './business-hours.js';
import type { Ticket } from './ticket.js';
import type { SlaPolicy, SlaTimerState } from '@uptimo/shared';
import type { TicketEvent } from './types.js';

export type { SlaPolicy, SlaTimerState };

export type SlaTimerKind = 'ack' | 'restore';
export type SlaStopReason = 'acknowledged' | 'started' | 'machine_running' | 'closed' | 'cancelled';

export interface SlaProjectionInput {
  ticket: Pick<Ticket, 'id' | 'kind' | 'severity' | 'status' | 'reportedAt' | 'closedAt'>;
  events: readonly TicketEvent[];
  policy: SlaPolicy;
  calendar?: BusinessCalendar;
  now: Date;
}

export interface SlaTimerProjection {
  id: string;
  state: SlaTimerState;
  breached: boolean;
  dueAt: Date | null;
  pausedAt: Date | null;
  stoppedAt: Date | null;
  remainingMinutes: number;
  stopReason: SlaStopReason | null;
}

export type SlaTimerSet = Readonly<Record<SlaTimerKind, SlaTimerProjection>>;

const MINUTE_MS = 60_000;

/** Signed minutes until a deadline, rounded away from zero. */
export function remainingSlaMinutes(dueAt: Date, at: Date): number {
  const milliseconds = dueAt.getTime() - at.getTime();
  return Math.sign(milliseconds) * Math.ceil(Math.abs(milliseconds) / MINUTE_MS);
}

/** Whether an active clock has reached its deadline. */
export function slaBreached(dueAt: Date, at: Date): boolean {
  return dueAt.getTime() <= at.getTime();
}

/** Project both SLA clocks from the effective ticket timeline. */
export function projectSlaTimers(input: SlaProjectionInput): SlaTimerSet {
  assertProjectionInput(input);
  return {
    ack: projectedTimer(input, 'ack', input.policy.ackMinutes, ackTerminal(input)),
    restore: projectedTimer(input, 'restore', input.policy.restoreMinutes, restoreTerminal(input)),
  };
}

function assertProjectionInput(input: SlaProjectionInput): void {
  assertPolicy(input);
  if (input.policy.businessHoursOnly && !input.calendar) {
    throw new SlaInputError('invalid_calendar', 'Business-hours mode requires a calendar');
  }
  if (
    !validDate(input.ticket.reportedAt) ||
    !validDate(input.now) ||
    input.now < input.ticket.reportedAt
  ) {
    throw new SlaInputError('invalid_timeline', 'Invalid report or projection time');
  }
  for (const event of input.events) assertEvent(input, event);
  const start = input.events.find((event) => event.type === 'start' || event.type === 'pickup');
  const close = input.events.find((event) => event.type === 'close');
  const startedAt = start ? correctedTime(input, 'startedAt', start.at) : null;
  const closedAt = close ? correctedTime(input, 'closedAt', close.at) : null;
  if (startedAt && closedAt && closedAt < startedAt) {
    throw new SlaInputError('invalid_timeline', 'Effective close precedes effective start');
  }
}

function assertPolicy(input: SlaProjectionInput): void {
  if (input.policy.severity !== input.ticket.severity) {
    throw new SlaInputError(
      'invalid_policy',
      `Policy severity ${input.policy.severity} does not match ticket severity ${input.ticket.severity}`,
    );
  }
  if (!positiveMinutes(input.policy.ackMinutes) || !positiveMinutes(input.policy.restoreMinutes)) {
    throw new SlaInputError('invalid_policy', 'Policy targets must be positive whole minutes');
  }
}

function assertEvent(input: SlaProjectionInput, event: TicketEvent): void {
  if (event.type === 'pause' && typeof event.pausesSla !== 'boolean') {
    throw new SlaInputError('missing_pause_flag', 'Pause is missing its pausesSla snapshot');
  }
  const beforeReport =
    event.at < input.ticket.reportedAt && event.type !== 'down' && event.type !== 'edit';
  if (!validDate(event.at) || event.at > input.now || beforeReport) {
    throw new SlaInputError('invalid_timeline', `Invalid event time: ${event.type}`);
  }
}

function positiveMinutes(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function ackTerminal(input: SlaProjectionInput): Terminal | undefined {
  const start = input.events.find((event) => event.type === 'start' || event.type === 'pickup');
  const acknowledged = input.events.find((event) => event.type === 'acknowledge');
  const close = input.events.find((event) => event.type === 'close');
  return earliest([
    start ? { at: correctedTime(input, 'startedAt', start.at), reason: 'started' } : undefined,
    acknowledged ? { at: acknowledged.at, reason: 'acknowledged' } : undefined,
    close ? { at: correctedTime(input, 'closedAt', close.at), reason: 'closed' } : undefined,
  ]);
}

function correctedTime(
  input: SlaProjectionInput,
  field: 'startedAt' | 'closedAt',
  initial: Date,
): Date {
  let corrected = initial;
  for (const event of input.events) {
    if (event.type !== 'edit') continue;
    for (const change of event.changes ?? []) {
      if (change.field !== field) continue;
      const value = change.to as Date;
      if (!validDate(value) || value < input.ticket.reportedAt || value > input.now) {
        throw new SlaInputError('invalid_timeline', `Invalid ${field} correction`);
      }
      corrected = value;
    }
  }
  return corrected;
}

function restoreTerminal(input: SlaProjectionInput): Terminal | undefined {
  const running =
    input.ticket.kind === 'stopped'
      ? input.events.find((event) => event.type === 'running')
      : undefined;
  const close = input.events.find((event) => event.type === 'close');
  return earliest([
    running ? { at: running.at, reason: 'machine_running' } : undefined,
    close ? { at: correctedTime(input, 'closedAt', close.at), reason: 'closed' } : undefined,
  ]);
}

function earliest(candidates: Array<Terminal | undefined>): Terminal | undefined {
  return candidates
    .filter((candidate): candidate is Terminal => candidate !== undefined)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
}

interface Terminal {
  at: Date;
  reason: SlaStopReason;
}

function projectedTimer(
  input: SlaProjectionInput,
  kind: SlaTimerKind,
  targetMinutes: number,
  terminal?: Terminal,
): SlaTimerProjection {
  const timeline = activeTimeline(input, kind, terminal);
  const boundary = timeline.boundary;
  const consumed = timeline.intervals.reduce(
    (total, interval) => total + eligibleMs(input, interval),
    0,
  );
  const remaining = targetMinutes * MINUTE_MS - consumed;
  const dueAt = deadline({
    clock: input,
    timeline,
    target: targetMinutes * MINUTE_MS,
    remaining,
    boundary,
  });
  const breached = timeline.stoppedAt
    ? dueAt !== null && dueAt < timeline.boundary
    : timeline.state === 'paused'
      ? remaining <= 0
      : dueAt !== null && slaBreached(dueAt, input.now);
  return {
    id: `${input.ticket.id}:${kind}`,
    state: timeline.state,
    breached,
    dueAt,
    pausedAt: timeline.pausedAt,
    stoppedAt: timeline.stoppedAt,
    remainingMinutes: remainingSlaMinutes(new Date(boundary.getTime() + remaining), boundary),
    stopReason: timeline.stopReason,
  };
}

interface Interval {
  start: Date;
  end: Date;
}

interface Timeline {
  intervals: Interval[];
  state: SlaTimerState;
  pausedAt: Date | null;
  stoppedAt: Date | null;
  stopReason: SlaStopReason | null;
  boundary: Date;
}

interface ClockWork {
  intervals: Interval[];
  runningSince: Date | null;
  pausedAt: Date | null;
  stoppedAt: Date | null;
  pausedAtCancel: Date | null;
  cancelled: boolean;
  terminalAtCancel: Terminal | null;
  boundary: Date;
  terminal?: Terminal;
  now: Date;
}

function activeTimeline(
  input: SlaProjectionInput,
  kind: SlaTimerKind,
  terminal?: Terminal,
): Timeline {
  const work: ClockWork = {
    intervals: [],
    runningSince: input.ticket.reportedAt,
    pausedAt: null,
    stoppedAt: null,
    pausedAtCancel: null,
    cancelled: false,
    terminalAtCancel: null,
    boundary: terminal?.at ?? input.now,
    terminal,
    now: input.now,
  };
  for (const event of input.events) {
    if (skipEvent(work, event)) continue;
    if (event.type === 'cancel') cancelClock(work, event.at);
    else if (event.type === 'restore') restoreClock(work, event.at);
    else applyWait(work, event, kind);
  }
  closeRunning(work, work.boundary);
  return finalTimeline(work);
}

function finalTimeline(work: ClockWork): Timeline {
  const finalStop = work.cancelled ? work.stoppedAt : (work.terminal?.at ?? work.stoppedAt);
  const stopReason = work.cancelled
    ? 'cancelled'
    : (work.terminal?.reason ?? (work.stoppedAt ? 'cancelled' : null));
  return {
    intervals: work.intervals,
    state: finalStop ? 'stopped' : work.pausedAt ? 'paused' : 'running',
    pausedAt: finalStop ? null : work.pausedAt,
    stoppedAt: finalStop,
    stopReason,
    boundary: work.boundary,
  };
}

function skipEvent(work: ClockWork, event: TicketEvent): boolean {
  if (event.at > work.now) return true;
  if (!work.terminal || event.at < work.terminal.at) return false;
  return event.type !== 'cancel' && event.type !== 'restore';
}

function closeRunning(work: ClockWork, at: Date): void {
  if (!work.runningSince) return;
  if (at < work.runningSince) {
    throw new SlaInputError('invalid_timeline', 'SLA interval ends before it starts');
  }
  work.intervals.push({ start: work.runningSince, end: at });
  work.runningSince = null;
}

function cancelClock(work: ClockWork, at: Date): void {
  work.terminalAtCancel = work.terminal && work.terminal.at <= at ? work.terminal : null;
  const cutoff = work.terminalAtCancel?.at ?? at;
  closeRunning(work, cutoff);
  work.stoppedAt = at;
  work.pausedAtCancel = work.terminalAtCancel ? null : work.pausedAt;
  work.pausedAt = null;
  work.cancelled = true;
  work.boundary = cutoff;
}

function restoreClock(work: ClockWork, at: Date): void {
  if (!work.cancelled) return;
  work.runningSince = !work.terminalAtCancel && !work.pausedAtCancel ? at : null;
  work.pausedAt = !work.terminalAtCancel && work.pausedAtCancel ? at : null;
  work.pausedAtCancel = null;
  work.stoppedAt = null;
  work.cancelled = false;
  work.boundary = work.terminalAtCancel?.at ?? work.terminal?.at ?? work.now;
  work.terminalAtCancel = null;
}

function applyWait(work: ClockWork, event: TicketEvent, kind: SlaTimerKind): void {
  if (work.cancelled || kind !== 'restore') return;
  if (event.type === 'pause' && event.pausesSla && work.runningSince) {
    closeRunning(work, event.at);
    work.pausedAt = event.at;
  } else if (event.type === 'resume' && !work.runningSince) {
    work.runningSince = event.at;
    work.pausedAt = null;
  }
}

interface DeadlineInput {
  clock: SlaProjectionInput;
  timeline: Timeline;
  target: number;
  remaining: number;
  boundary: Date;
}

function deadline(input: DeadlineInput): Date | null {
  let untilDue = input.target;
  for (const interval of input.timeline.intervals) {
    const duration = eligibleMs(input.clock, interval);
    if (untilDue <= duration) return addEligible(input.clock, interval.start, untilDue);
    untilDue -= duration;
  }
  if (input.timeline.state === 'paused') return null;
  return addEligible(input.clock, input.boundary, Math.max(0, input.remaining));
}

function eligibleMs(input: SlaProjectionInput, interval: Interval): number {
  if (input.policy.businessHoursOnly) {
    return (
      businessMinutesBetween(interval.start, interval.end, input.calendar as BusinessCalendar) *
      MINUTE_MS
    );
  }
  return Math.max(0, interval.end.getTime() - interval.start.getTime());
}

function addEligible(input: SlaProjectionInput, from: Date, milliseconds: number): Date {
  if (input.policy.businessHoursOnly) {
    return addBusinessMinutes(from, milliseconds / MINUTE_MS, input.calendar as BusinessCalendar);
  }
  return new Date(from.getTime() + milliseconds);
}
