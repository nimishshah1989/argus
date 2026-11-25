import type { Sheet } from '@uptimo/shared/xlsx';
import type { LogWords } from './model.js';

/**
 * The Breakdown Log's Excel download (sweep 706, ADR 0041: replaces the CSV export; the page passes
 * `docRef={DOC_REF.breakdowns}`). `log` is `everyMatchOf(reply, query, t)`: the engine's header (its first column is
 * the eye, `''`) plus Supported by, and every row of the whole narrowed log in the order asked.
 *
 * Exactly one sheet, named `words.table.title`. Its rows are the header row first, then one row per log row, each with
 * the first (eye) column left out: the same columns, in the same order, as the CSV wrote. Every cell is the string
 * the engine printed, unchanged (never parsed to a number, never re-rounded; `'—'` stays `'—'`, `''` stays `''`).
 * A log with no header (the engine printed none: `{ header: [], rows: [] }`) is one sheet with no rows. The inputs
 * are never mutated.
 */
export function logSheets(
  log: { header: readonly string[]; rows: readonly (readonly string[])[] },
  words: LogWords,
): Sheet[] {
  void log;
  void words;
  throw new Error('not implemented');
}
