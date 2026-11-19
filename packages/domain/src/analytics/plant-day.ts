const formatters = new Map<string, Intl.DateTimeFormat>();
const days = new Map<string, string>();
const MEMO_LIMIT = 100_000;

/**
 * The plant date (`YYYY-MM-DD`) of an instant in the plant's own time zone. A breakdown at 01:00 on 1 November in
 * Asia/Kolkata is stored as 19:30Z on 31 October, and it belongs to 1 November. The zone is always passed in: nothing
 * in the engine reads the machine's own zone.
 *
 * The same instants are asked for again by many figures, and `toLocaleDateString` builds a formatter on every call,
 * so the formatter is kept per zone and a string instant's answer is remembered (bounded). The text is the same.
 */
export function plantDay(instant: string | Date, timeZone: string): string {
  const key = typeof instant === 'string' ? `${timeZone}|${instant}` : null;
  const known = key === null ? undefined : days.get(key);
  if (known !== undefined) return known;
  const date = new Date(instant);
  let day: string;
  if (Number.isNaN(date.getTime())) {
    day = date.toLocaleDateString('en-CA', { timeZone });
  } else {
    let format = formatters.get(timeZone);
    if (format === undefined) {
      format = new Intl.DateTimeFormat('en-CA', { timeZone });
      formatters.set(timeZone, format);
    }
    day = format.format(date);
  }
  if (key !== null) {
    if (days.size >= MEMO_LIMIT) days.clear();
    days.set(key, day);
  }
  return day;
}
