import type { FigureInput, Figures, OverridableFigure, TicketEvent } from './types.js';

/** His `mins()`: every elapsed time is rounded to the nearest whole minute, never below zero. */
function wholeMin(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function sortedEvents(events: TicketEvent[]): TicketEvent[] {
  return [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** His `down_acc` (finished stopped stretches) and the time the current stopped stretch began, if one is open. */
function downStretches(input: FigureInput): { done: number; openSince: Date | null } {
  if (input.kind !== 'stopped') return { done: 0, openSince: null };
  let acc = 0;
  let downStart = input.kindUpgradedAt ?? input.reportedAt;
  let isDown = true;
  const closeDown = (at: Date) => {
    if (!isDown) return;
    acc += wholeMin(downStart, at);
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
    else if (event.type === 'stopped') since = null;
  }
  return since;
}

/** Repair is the wall clock from the first start to the close, or to the time the machine ran again; 0 until the close. */
function repairMinutes(input: FigureInput, events: TicketEvent[]): number {
  const first = events.find((event) => event.type === 'start' || event.type === 'pickup');
  if (!first || !input.closedAt) return 0;
  return wholeMin(first.at, runningSince(events) ?? input.closedAt);
}

function waitingMinutes(events: TicketEvent[]) {
  let waitMin = 0;
  let vendorMin = 0;
  let pauseAt: Date | null = null;
  let pauseIsVendor = false;
  const close = (at: Date) => {
    if (!pauseAt) return;
    const minutes = wholeMin(pauseAt, at);
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

function handoverAndFollow(events: TicketEvent[], closedAt?: Date) {
  let handoverWaitMin = 0;
  let handoverAt: Date | null = null;
  const closeHandover = (at: Date) => {
    if (!handoverAt) return;
    handoverWaitMin += wholeMin(handoverAt, at);
    handoverAt = null;
  };
  for (const event of events) {
    if (event.type === 'transfer') handoverAt = event.at;
    if (event.type === 'pickup' || event.type === 'close') closeHandover(event.at);
  }
  const lastRunningAt = runningSince(events);
  const followMin = closedAt && lastRunningAt ? wholeMin(lastRunningAt, closedAt) : null;
  return { handoverWaitMin, followMin };
}

function perPerson(input: FigureInput): Record<string, number> {
  const result: Record<string, number> = {};
  for (const segment of input.segments) {
    const minutes = wholeMin(segment.startedAt, segment.endedAt ?? input.now);
    result[segment.personId] = (result[segment.personId] ?? 0) + minutes;
  }
  return result;
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
function downtimeAtClose(input: FigureInput, handsOnMin: number): number | null {
  if (!input.closedAt) return null;
  if (input.kind === 'support') return 0;
  if (input.kind === 'general') return handsOnMin;
  const { done, openSince } = downStretches(input);
  return done + (openSince ? wholeMin(openSince, input.closedAt) : 0);
}

export function figures(input: FigureInput): Figures {
  const events = sortedEvents(input.events);
  const overrides = input.overrides ?? {};
  const { waitMin, vendorMin } = waitingMinutes(events);
  const { handoverWaitMin, followMin } = handoverAndFollow(events, input.closedAt);

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
    downtimeAtClose(input, active),
  );
  const repair = applyOverride(
    overridden,
    'repairMin',
    overrides.repairMin,
    repairMinutes(input, events),
  );

  return {
    responseMin: response,
    activeMin: active,
    waitMin: waiting,
    vendorMin,
    handoverWaitMin,
    downAccMin: downStretches(input).done,
    downtimeMin: downtime,
    followMin,
    repairMin: repair,
    perPerson: perPerson(input),
    overridden,
  };
}
