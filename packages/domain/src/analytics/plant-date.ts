const PLANT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** A plant date (`YYYY-MM-DD`) as a whole UTC day number, so two dates compare without a time zone or a clock. */
export function dayNumber(date: string): number | null {
  const match = PLANT_DATE.exec(date);
  if (!match) return null;
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
  return Number.isFinite(day) ? day : null;
}

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
