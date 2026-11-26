import { fill } from '../../../i18n/fill.js';
import type { PageTable } from '../../analytics/page-content.js';

/**
 * The platform prints a month-on-month matrix as pairs of rows: the first row carries the label, a measure line
 * glued to it ("Cell 1BD % / PM %") and the first measure; the second row carries the second measure with no label
 * and sits one column to the left. Read as printed, the second row's figures fall under the wrong month. Here a pair
 * becomes two aligned tables, one per measure, with the same labels and every figure the engine printed.
 */

/** The measure lines the engine glues to a label, then optionally the count it prints after them. */
const GLUED = /^(.*?)((?:BD % \/ PM %)|(?:MTTR \/ MTBF))(?: · (\d[\d,]*) breakdowns)?$/;

export type PairWords = {
  /** `{title}` and `{measure}`: the heading of each of the two tables. */
  title: string;
  /** The two measures when the engine does not name them (the PM matrix: jobs, then hours). */
  fallback: readonly [string, string];
  /** The header of the column that keeps the count the engine printed beside a label. */
  count: string;
};

/** One table of a pair, with the measure it holds ("BD %"): its month columns take their look from it, not the title. */
export type Half = PageTable & { measure: string };

/** Splits "BD % / PM %" into its two measures. */
const measuresOf = (line: string): [string, string] | null => {
  const [a, b] = line.split(' / ');
  return a !== undefined && b !== undefined ? [a, b] : null;
};

/** One pair of printed rows read as a label, its count if the engine glued one, and the two lines of figures. */
function readPair(row: string[], next: string[]) {
  const found = GLUED.exec(row[0] ?? '');
  const label = found ? (found[1] ?? '') : (row[0] ?? '');
  return {
    label,
    count: found?.[3] ?? '',
    measures: found?.[2] ? measuresOf(found[2]) : null,
    first: [label, ...row.slice(1)],
    second: [label, ...next],
  };
}

/**
 * The two aligned tables of a paired matrix, or null when the table is not one (every row is as wide as the header,
 * or a row the pairing cannot place). A row the engine printed one column short is the second line of the row above.
 */
export function unpair(table: PageTable, words: PairWords): [Half, Half] | null {
  const width = table.header.length;
  const pairs: ReturnType<typeof readPair>[] = [];
  for (let at = 0; at < table.rows.length; at += 2) {
    const [row, next] = [table.rows[at], table.rows[at + 1]];
    if (row?.length !== width || next?.length !== width - 1) return null;
    pairs.push(readPair(row, next));
  }
  if (pairs.length === 0) return null;
  const [one, two] = pairs.find((pair) => pair.measures)?.measures ?? words.fallback;
  const counted = pairs.some((pair) => pair.count !== '');
  const build = (pick: 'first' | 'second', measure: string): Half => {
    const rows = pairs.map((pair) => {
      const cells = pair[pick];
      return counted ? [cells[0] ?? '', pair.count, ...cells.slice(1)] : cells;
    });
    const [head, ...rest] = table.header;
    return {
      ...table,
      title: fill(words.title, { title: table.title, measure }),
      measure,
      header: counted ? [head ?? '', words.count, ...rest] : table.header,
      rows,
      rowCount: rows.length,
    };
  };
  return [build('first', one), build('second', two)];
}
