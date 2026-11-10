import type { FigureInput, Figures, OverridableFigure, TicketEvent } from './types.js';

function wholeMin(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
}

function sortedEvents(events: TicketEvent[]): TicketEvent[] {
  return [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
}

function unionMinutes(intervals: Array<[Date, Date]>): number {
  const ordered = intervals
    .filter(([start, end]) => end.getTime() > start.getTime())
    .sort((a, b) => a[0].getTime() - b[0].getTime());
  let total = 0;
  let curStart: Date | null = null;
  let curEnd: Date | null = null;
  for (const [start, end] of ordered) {
    if (curEnd === null || start.getTime() > curEnd.getTime()) {
      if (curEnd !== null) total += wholeMin(curStart as Date, curEnd);
      curStart = start;
      curEnd = end;
    } else if (end.getTime() > curEnd.getTime()) {
      curEnd = end;
    }
  }
  if (curEnd !== null) total += wholeMin(curStart as Date, curEnd);
  return total;
}

function downtimeAcc(input: FigureInput, until: Date): number {
  if (input.kind !== 'stopped') return 0;
  let acc = 0;
  let downStart = input.kindUpgradedAt ?? input.reportedAt;
  let isDown = true;
  let downAtCancel = false;
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
    else if (event.type === 'cancel') {
      downAtCancel = isDown;
      closeDown(event.at);
    } else if (event.type === 'restore' && downAtCancel) {
      openDown(event.at);
      downAtCancel = false;
    }
  }
  if (isDown) acc += wholeMin(downStart, until);
  return acc;
}

function responseMin(input: FigureInput, events: TicketEvent[]): number | null {
  const firstStart = events.find((event) => event.type === 'start' || event.type === 'pickup');
  if (input.selfStarted || !firstStart) return null;
  return wholeMin(input.reportedAt, firstStart.at);
}

function activeAndRepair(input: FigureInput) {
  const closedAt = input.closedAt;
  const active = unionMinutes(
    input.segments.map((segment) => [segment.startedAt, segment.endedAt ?? input.now]),
  );
  const repair = closedAt
    ? unionMinutes(
        input.segments.map((segment) => [segment.startedAt, segment.endedAt ?? closedAt]),
      )
    : active;
  return { activeMin: active, repairMin: repair };
}

function waitingMinutes(events: TicketEvent[], now: Date) {
  let waitMin = 0;
  let vendorMin = 0;
  let pauseAt: Date | null = null;
  let pauseIsVendor = false;
  let waitingAtCancel = false;
  let vendorAtCancel = false;
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
    } else if (event.type === 'cancel') {
      waitingAtCancel = pauseAt !== null;
      vendorAtCancel = pauseIsVendor;
      close(event.at);
    } else if (event.type === 'restore' && waitingAtCancel) {
      pauseAt = event.at;
      pauseIsVendor = vendorAtCancel;
      waitingAtCancel = false;
    }
  }
  close(now);
  return { waitMin, vendorMin };
}

function handoverAndFollow(events: TicketEvent[], now: Date, closedAt?: Date) {
  let handoverWaitMin = 0;
  let handoverAt: Date | null = null;
  let handoverAtCancel = false;
  let lastRunningAt: Date | null = null;
  const closeHandover = (at: Date) => {
    if (!handoverAt) return;
    handoverWaitMin += wholeMin(handoverAt, at);
    handoverAt = null;
  };
  for (const event of events) {
    if (event.type === 'transfer') handoverAt = event.at;
    if (event.type === 'pickup') closeHandover(event.at);
    if (event.type === 'cancel') {
      handoverAtCancel = handoverAt !== null;
      closeHandover(event.at);
    }
    if (event.type === 'restore' && handoverAtCancel) {
      handoverAt = event.at;
      handoverAtCancel = false;
    }
    if (event.type === 'running') lastRunningAt = event.at;
  }
  if (handoverAt) handoverWaitMin += wholeMin(handoverAt, now);
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

export function figures(input: FigureInput): Figures {
  const events = sortedEvents(input.events);
  const overrides = input.overrides ?? {};
  const { activeMin, repairMin } = activeAndRepair(input);
  const { waitMin, vendorMin } = waitingMinutes(events, input.now);
  const { handoverWaitMin, followMin } = handoverAndFollow(events, input.now, input.closedAt);
  const downAccMin = downtimeAcc(input, input.now);
  const downtimeMin =
    input.kind === 'stopped' && input.closedAt
      ? Math.max(1, downtimeAcc(input, input.closedAt))
      : null;

  const overridden: OverridableFigure[] = [];
  const response = applyOverride(
    overridden,
    'responseMin',
    overrides.responseMin,
    responseMin(input, events),
  );
  const active = applyOverride(overridden, 'activeMin', overrides.handsOnOverrideMin, activeMin);
  const waiting = applyOverride(overridden, 'waitMin', overrides.waitingOverrideMin, waitMin);
  const downtime = applyOverride(overridden, 'downtimeMin', overrides.downtimeMin, downtimeMin);
  const repair = applyOverride(overridden, 'repairMin', overrides.repairMin, repairMin);

  return {
    responseMin: response,
    activeMin: active,
    waitMin: waiting,
    vendorMin,
    handoverWaitMin,
    downAccMin,
    downtimeMin: downtime,
    followMin,
    repairMin: repair,
    perPerson: perPerson(input),
    overridden,
  };
}
