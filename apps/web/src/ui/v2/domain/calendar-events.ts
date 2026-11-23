/**
 * What the month calendar is given and says back. Kept apart from the calendar itself (`month-calendar.tsx`), which is
 * the one file that names the calendar library and is only ever reached through a lazy `import()` (ADR 0009 R1).
 */

/** One all-day job on the grid: the code it prints, its plant day and what a screen reader hears. */
export type CalendarEvent = {
  id: string;
  /** What the chip prints (a machine code). */
  code: string;
  /** The plant day, `YYYY-MM-DD`. */
  day: string;
  /** An open job (a clock) rather than a planned one (a tick). */
  open: boolean;
  /** Another job shares its day: marked by an icon, a dotted underline and the words in `aria`. */
  crowded: boolean;
  /** A started job is not draggable: the server would refuse it and the chip would snap back. */
  movable: boolean;
  /** `date, status` said after the code, for a screen reader. */
  aria: string;
};

/** The grid's six weeks, both ends inclusive plant days. */
export type CalendarRange = { from: string; to: string };

/** The grid's inclusive range from the library's own dates: its `end` is exclusive, ours is not. */
export function gridRange(start: string, endExclusive: string): CalendarRange {
  const end = new Date(Date.parse(`${endExclusive.slice(0, 10)}T00:00:00Z`) - 86_400_000);
  return { from: start.slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export type CalendarWords = {
  /** The grid's name for a screen reader. */
  label: string;
  /** The button that goes back to the plant's today. */
  today: string;
};
