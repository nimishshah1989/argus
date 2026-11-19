const PLANT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** A plant date (`YYYY-MM-DD`) as a whole UTC day number, so two dates compare without a time zone or a clock. */
export function dayNumber(date: string): number | null {
  const known = parsedDays.get(date);
  if (known !== undefined) return known;
  const match = PLANT_DATE.exec(date);
  let day: number | null = null;
  if (match) {
    const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
    day = Number.isFinite(value) ? value : null;
  }
  if (parsedDays.size >= MEMO_LIMIT) parsedDays.clear();
  parsedDays.set(date, day);
  return day;
}

/** The days already read: a plant has a few thousand distinct dates and the figures read each one many times. */
const parsedDays = new Map<string, number | null>();
const MEMO_LIMIT = 100_000;

/** A whole UTC day number as the plant's `DD-MM-YYYY`, the platform's own written form. */
export function dmyOfDay(day: number): string {
  const date = new Date(day * DAY_MS);
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${two(date.getUTCDate())}-${two(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

/** A plant date as the platform writes it (`DD-MM-YYYY`); an unreadable date is returned untouched. */
export function dmy(date: string): string {
  const match = PLANT_DATE.exec(date);
  if (!match) return date;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * A plant date `months` later, clamped to the shorter month's last day (31 Jan + 1 month is 28/29 Feb), as an ISO
 * day. Null when the date or the month count is unreadable: a register row stores no invented date (R3).
 */
export function addMonths(date: string, months: number): string | null {
  const match = PLANT_DATE.exec(date.slice(0, 10));
  if (!match || !Number.isFinite(months)) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const target = new Date(Date.UTC(year, month - 1 + Math.trunc(months), 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

/**
 * The last day of a term that many months long: the day before `addMonths`, so a contract starting 1 January for
 * 12 months ends 31 December. Null when the date is unreadable, the same as `addMonths`.
 */
export function endOfTerm(date: string, months: number): string | null {
  const end = addMonths(date, months);
  const day = end === null ? null : dayNumber(end);
  return day === null ? null : new Date((day - 1) * DAY_MS).toISOString().slice(0, 10);
}
