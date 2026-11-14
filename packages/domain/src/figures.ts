import { personMinutes } from './person-minutes.js';
import type { FigureInput, Figures, OverridableFigure, TicketEvent } from './types.js';

type Gap = [start: number, end: number];

/**
 * The time a ticket spent cancelled before it was restored. Nimish's ruling (14 Nov 2026, differs from his `worker.js`):
 * that time is not waiting, handover wait or downtime. A cancel with no restore is not a gap (the ticket stays cancelled).
 */
function cancelledGaps(events: TicketEvent[]): Gap[] {
  const gaps: Gap[] = [];
  let since: number | null = null;
  let closedAt = 0;
  for (const event of events) {
    if (event.type === 'close') closedAt = event.at.getTime();
    // production sent a closed ticket back: the time it sat signed off is nobody's repair or downtime
    else if (event.type === 'handback_dispute') gaps.push([closedAt, event.at.getTime()]);
    else if (event.type === 'cancel') since = event.at.getTime();
    else if (event.type === 'restore' && since !== null) {
      gaps.push([since, event.at.getTime()]);
      since = null;
    }
  }
  return gaps;
}

/** His `mins()`: every elapsed time is rounded to the nearest whole minute, never below zero (less any cancelled time). */
function wholeMin(a: Date, b: Date, gaps: Gap[] = []): number {
  const start = a.getTime();
  const end = b.getTime();
  const cancelled = gaps.reduce(
    (sum, [from, to]) => sum + Math.max(0, Math.min(end, to) - Math.max(start, from)),
    0,
  );
  return Math.max(0, Math.round((end - start - cancelled) / 60000));
}

function sortedEvents(events: TicketEvent[]): TicketEvent[] {
  return [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** His `down_acc` (finished stopped stretches) and the time the current stopped stretch began, if one is open. */
function downStretches(input: FigureInput, gaps: Gap[]): { done: number; openSince: Date | null } {
  if (input.kind !== 'stopped') return { done: 0, openSince: null };
  let acc = 0;
  let downStart = input.kindUpgradedAt ?? input.reportedAt;
  let isDown = true;
  let closedAt = input.reportedAt;
  const closeDown = (at: Date) => {
    if (!isDown) return;
    acc += wholeMin(downStart, at, gaps);
    isDown = false;
  };
  const openDown = (at: Date) => {
    downStart = at;
    isDown = true;
  };
  for (const event of sortedEvents(input.events)) {
    if (event.type === 'running') closeDown(event.at);
    else if (event.type === 'stopped' && !isDown) openDown(event.at);
    else if (event.type === 'upgrade_kind') openDown(event.at);
    else if (event.type === 'close') closedAt = event.at;
    else if (event.type === 'handback_dispute') {
      // production said it is not fixed: the machine was up until now (or since the close, if never marked running)
      closeDown(closedAt);
      openDown(event.at);
    }
  }
  return { done: acc, openSince: isDown ? downStart : null };
}

function responseMin(input: FigureInput, events: TicketEvent[]): number | null {
  const firstStart = events.find((event) => event.type === 'start' || event.type === 'pickup');
  if (input.selfStarted || !firstStart) return null;
  return wholeMin(input.reportedAt, firstStart.at);
}

/** Hands-on is the lead's finished stretches only; a crew member's minutes are theirs (perPerson), not the job's. */
function handsOn(input: FigureInput): number {
  return input.segments
    .filter((segment) => segment.role === 'lead' && segment.endedAt)
    .reduce((sum, segment) => sum + wholeMin(segment.startedAt, segment.endedAt as Date), 0);
}

/** The time the machine last ran again, if it is still running (a later `stopped` cancels it). */
function runningSince(events: TicketEvent[]): Date | null {
  let since: Date | null = null;
  for (const event of events) {
    if (event.type === 'running') since = event.at;
    else if (event.type === 'stopped' || event.type === 'handback_dispute') since = null;
  }
  return since;
}

/** Repair is the wall clock from the first start to the close, or to the time the machine ran again; 0 until the close. */
function repairMinutes(input: FigureInput, events: TicketEvent[], gaps: Gap[]): number {
  const first = events.find((event) => event.type === 'start' || event.type === 'pickup');
  if (!first || !input.closedAt) return 0;
  return wholeMin(first.at, runningSince(events) ?? input.closedAt, gaps);
}

function waitingMinutes(events: TicketEvent[], gaps: Gap[]) {
  let waitMin = 0;
  let vendorMin = 0;
  let pauseAt: Date | null = null;
  let pauseIsVendor = false;
  const close = (at: Date) => {
    if (!pauseAt) return;
    const minutes = wholeMin(pauseAt, at, gaps);
    waitMin += minutes;
    if (pauseIsVendor) vendorMin += minutes;
    pauseAt = null;
  };
  for (const event of events) {
    if (event.type === 'pause') {
      pauseAt = event.at;
      pauseIsVendor = Boolean(event.isVendor);
    } else if (event.type === 'resume' || event.type === 'close') {
      close(event.at);
    }
  }
  return { waitMin, vendorMin };
}

function handoverAndFollow(events: TicketEvent[], gaps: Gap[], closedAt?: Date) {
  let handoverWaitMin = 0;
  let handoverAt: Date | null = null;
  const closeHandover = (at: Date) => {
    if (!handoverAt) return;
    handoverWaitMin += wholeMin(handoverAt, at, gaps);
    handoverAt = null;
  };
  for (const event of events) {
    if (event.type === 'transfer') handoverAt = event.at;
    if (event.type === 'pickup' || event.type === 'close') closeHandover(event.at);
  }
  const lastRunningAt = runningSince(events);
  const followMin = closedAt && lastRunningAt ? wholeMin(lastRunningAt, closedAt, gaps) : null;
  return { handoverWaitMin, followMin };
}

function applyOverride<T>(
  overridden: OverridableFigure[],
  key: OverridableFigure,
  override: T | undefined,
  computed: T,
): T {
  if (override !== undefined) overridden.push(key);
  return override ?? computed;
}

/** Closed minutes by his rule: a stopped machine is the stopped stretches, support none, general the hands-on. */
function downtimeAtClose(input: FigureInput, handsOnMin: number, gaps: Gap[]): number | null {
  if (!input.closedAt) return null;
  if (input.kind === 'support') return 0;
  if (input.kind === 'general') return handsOnMin;
  const { done, openSince } = downStretches(input, gaps);
  return done + (openSince ? wholeMin(openSince, input.closedAt, gaps) : 0);
}

export function figures(input: FigureInput): Figures {
  const events = sortedEvents(input.events);
  const overrides = input.overrides ?? {};
  const gaps = cancelledGaps(events);
  const { waitMin, vendorMin } = waitingMinutes(events, gaps);
  const { handoverWaitMin, followMin } = handoverAndFollow(events, gaps, input.closedAt);

  const overridden: OverridableFigure[] = [];
  const response = applyOverride(
    overridden,
    'responseMin',
    overrides.responseMin,
    responseMin(input, events),
  );
  const active = applyOverride(
    overridden,
    'activeMin',
    overrides.handsOnOverrideMin,
    handsOn(input),
  );
  const waiting = applyOverride(overridden, 'waitMin', overrides.waitingOverrideMin, waitMin);
  const downtime = applyOverride(
    overridden,
    'downtimeMin',
    overrides.downtimeMin,
    downtimeAtClose(input, active, gaps),
  );
  const repair = applyOverride(
    overridden,
    'repairMin',
    overrides.repairMin,
    repairMinutes(input, events, gaps),
  );

  return {
    responseMin: response,
    activeMin: active,
    waitMin: waiting,
    vendorMin,
    handoverWaitMin,
    downAccMin: downStretches(input, gaps).done,
    downtimeMin: downtime,
    followMin,
    repairMin: repair,
    perPerson: personMinutes(input.segments, input.now),
    overridden,
  };
}
