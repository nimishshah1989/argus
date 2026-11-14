/**
 * The plant date (`YYYY-MM-DD`) of an instant in the plant's own time zone. A breakdown at 01:00 on 1 November in
 * Asia/Kolkata is stored as 19:30Z on 31 October, and it belongs to 1 November. The zone is always passed in: nothing
 * in the engine reads the machine's own zone.
 */
export function plantDay(instant: string | Date, timeZone: string): string {
  return new Date(instant).toLocaleDateString('en-CA', { timeZone });
}
