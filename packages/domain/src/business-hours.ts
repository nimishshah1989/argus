export type SlaInputErrorCode =
  'invalid_calendar' | 'invalid_policy' | 'invalid_timeline' | 'missing_pause_flag';

export class SlaInputError extends Error {
  constructor(
    readonly code: SlaInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SlaInputError';
  }
}

export interface ShiftWindow {
  code: string;
  startMinute: number;
  endMinute: number;
  crossesMidnight: boolean;
}

export interface BusinessCalendar {
  timeZone: string;
  windows: readonly ShiftWindow[];
}

interface Interval {
  start: number;
  end: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Return eligible business minutes in the half-open interval [from, to). */
export function businessMinutesBetween(from: Date, to: Date, calendar: BusinessCalendar): number {
  assertCalendar(calendar);
  if (from.getTime() > to.getTime()) throw new RangeError('from must not be after to');
  let eligible = 0;
  for (const interval of dailyIntervals(from, to, calendar)) {
    eligible += Math.max(
      0,
      Math.min(to.getTime(), interval.end) - Math.max(from.getTime(), interval.start),
    );
  }
  return eligible / MINUTE_MS;
}

/** Add eligible business minutes, stepping across closed periods. */
export function addBusinessMinutes(from: Date, minutes: number, calendar: BusinessCalendar): Date {
  assertCalendar(calendar);
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError('minutes must be positive');
  if (minutes === 0) return new Date(from);
  let cursor = from.getTime();
  let remaining = minutes * MINUTE_MS;
  for (let chunk = 0; ; chunk += 1) {
    const end = new Date(from.getTime() + (chunk + 1) * 31 * DAY_MS);
    const intervals = dailyIntervals(from, end, calendar).sort((a, b) => a.start - b.start);
    for (const interval of intervals) {
      const start = Math.max(cursor, interval.start);
      const available = Math.max(0, interval.end - start);
      if (remaining <= available) return new Date(start + remaining);
      remaining -= available;
      cursor = Math.max(cursor, interval.end);
    }
  }
}

function assertCalendar(calendar: BusinessCalendar): void {
  try {
    formatter(calendar.timeZone);
  } catch {
    throw new SlaInputError('invalid_calendar', 'Invalid calendar time zone');
  }
  if (calendar.windows.length === 0) {
    throw new SlaInputError('invalid_calendar', 'Calendar has no shift windows');
  }
  for (const window of calendar.windows) {
    if (!window.code.trim() || !validMinutes(window) || !validDirection(window)) {
      throw new SlaInputError('invalid_calendar', `Invalid shift window: ${window.code}`);
    }
  }
}

function validMinutes(window: ShiftWindow): boolean {
  return (
    Number.isInteger(window.startMinute) &&
    window.startMinute >= 0 &&
    window.startMinute < 1440 &&
    Number.isInteger(window.endMinute) &&
    window.endMinute >= 0 &&
    window.endMinute <= 1440
  );
}

function validDirection(window: ShiftWindow): boolean {
  return window.crossesMidnight
    ? window.endMinute < window.startMinute
    : window.endMinute > window.startMinute;
}

interface LocalParts {
  day: number;
  minute: number;
}

type PartsFormatter = Intl.DateTimeFormat;

function formatter(timeZone: string): PartsFormatter {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function localParts(at: Date, format: PartsFormatter): LocalParts {
  const values: Record<string, number> = {};
  for (const part of format.formatToParts(at)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  const day = Date.UTC(values.year!, values.month! - 1, values.day!) / DAY_MS;
  return { day, minute: values.hour! * 60 + values.minute! };
}

function localToUtc(day: number, minute: number, format: PartsFormatter): number {
  const localTime = day * DAY_MS + minute * MINUTE_MS;
  const offsets = new Set<number>();
  for (let delta = -2; delta <= 2; delta += 1) {
    const at = new Date(localTime + delta * DAY_MS);
    const parts = localParts(at, format);
    offsets.add(parts.day * DAY_MS + parts.minute * MINUTE_MS - at.getTime());
  }
  const candidates = [...offsets].map((offset) => localTime - offset);
  const valid = candidates.filter((candidate) => {
    const parts = localParts(new Date(candidate), format);
    return parts.day === day && parts.minute === minute;
  });
  // Earliest instant in a repeated wall time; shift forward across a wall-time gap.
  return valid.length > 0 ? Math.min(...valid) : Math.max(...candidates);
}

function dailyIntervals(from: Date, to: Date, calendar: BusinessCalendar): Interval[] {
  const format = formatter(calendar.timeZone);
  const intervals: Interval[] = [];
  const firstDay = localParts(from, format).day - 1;
  const lastDay = localParts(to, format).day;
  for (let day = firstDay; day <= lastDay; day += 1) {
    for (const window of calendar.windows) {
      const endDay = day + (window.crossesMidnight || window.endMinute === 1440 ? 1 : 0);
      intervals.push({
        start: localToUtc(day, window.startMinute, format),
        end: localToUtc(endDay, window.endMinute % 1440, format),
      });
    }
  }
  return mergeIntervals(intervals);
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const ordered = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}
