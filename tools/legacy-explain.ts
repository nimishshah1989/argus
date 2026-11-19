import type { ClassifiedRow } from '../apps/server/src/seed/legacy-classify.js';
import { HOURS_A_MONTH, type Difference } from './legacy-check.js';

/**
 * Ticket 69c, goal 5: for a machine-month where a summary sheet and the load differ, which counting rule of the sheet
 * reproduces the sheet's own pair from the log's rows. The sheets' monthly cells are typed by hand (no formula says
 * which rows they count: 568 of the first cells read are constants), so each rule is tried on the rows and the first
 * that gives the sheet's count and hours names the cause; a pair no rule gives is `unexplained`. Counts, codes and
 * months only.
 */
interface Pair {
  count: number;
  hours: number;
}
type Rows = readonly ClassifiedRow[];
type Hours = (c: ClassifiedRow) => number;

/** The sheet's own count and hours: MTBF gives the count (the full month with an MTTR means one), MTTR the hours. */
export function pairOf(d: Difference): Pair {
  const { mttr, mtbf } = d.sheet;
  const basis = d.month.includes('Q') ? 3 * HOURS_A_MONTH : HOURS_A_MONTH;
  const count =
    !mtbf || mtbf <= 0 ? 0 : mtbf >= basis ? ((mttr ?? 0) > 0 ? 1 : 0) : Math.round(basis / mtbf);
  return { count, hours: (mttr ?? 0) * count };
}

const minutesHours: Hours = (c) => c.row.minutes / 60;
const lossHours: Hours = (c) => (c.row.utiHours > 0 ? c.row.utiHours : c.row.minutes / 60);
const typedHours: Hours = (c) => c.row.hours ?? c.row.minutes / 60;
const HOURS_ROUNDING = 0.1;

const fits = (rows: Rows, sheet: Pair, of: Hours): boolean =>
  rows.length === sheet.count &&
  Math.abs(rows.reduce((n, c) => n + of(c), 0) - sheet.hours) <= HOURS_ROUNDING;

const isPm = (c: ClassifiedRow): boolean => c.row.code === 'PM';
const byRow = (a: ClassifiedRow, b: ClassifiedRow): number => a.row.excelRow - b.row.excelRow;
const gap = (c: ClassifiedRow): boolean => c.cls === 'gap_month' && !isPm(c);
const ticket = (c: ClassifiedRow): boolean => c.cls === 'ticket' && !isPm(c);

/** The kinds of row a month can hold; the load counts only the first. */
const KINDS: [string, (c: ClassifiedRow) => boolean][] = [
  ['loaded breakdowns', (c) => ticket(c) && c.row.minutes > 0],
  ['blank-minute rows', (c) => (ticket(c) || gap(c)) && c.row.minutes === 0],
  ['PM rows', (c) => c.cls === 'ticket' && isPm(c) && c.row.minutes > 0],
  ['utility rows', (c) => c.cls === 'utility'],
  ['duplicate rows', (c) => c.cls === 'duplicate' && !isPm(c)],
  ['held-out gap-month rows', (c) => gap(c) && c.row.minutes > 0],
];

/** Every choice of kinds, the fewest changes from the load's own choice first. */
function choices(): boolean[][] {
  const all = Array.from({ length: 1 << KINDS.length }, (_, mask) =>
    KINDS.map((_, i) => (mask >> i) % 2 === 1),
  );
  const away = (pick: boolean[]): number => pick.filter((on, i) => on !== (i === 0)).length;
  return all.filter((pick) => pick.some(Boolean)).sort((a, b) => away(a) - away(b));
}
const CHOICES = choices();

const nameOf = (pick: boolean[]): string => {
  const parts = KINDS.map(([name], i) => (pick[i] && i > 0 ? name : '')).filter(Boolean);
  if (parts.length === 0) return 'only the hours differ, by more than 0.05 h and up to 0.1 h';
  const list = parts.join(' + ');
  return pick[0] ? `sheet counts the loaded breakdowns + ${list}` : `sheet counts only ${list}`;
};

/** A sheet range that covers only the first or only the last rows of the month. */
function rangeRule(counted: Rows, sheet: Pair): string | null {
  if (sheet.count === 0 || sheet.count >= counted.length) return null;
  if (fits(counted.slice(0, sheet.count), sheet, minutesHours))
    return 'sheet range stops short (first rows only)';
  if (fits(counted.slice(-sheet.count), sheet, minutesHours))
    return 'sheet range starts late (last rows only)';
  return null;
}

/** A choice of row kinds the sheet counts, the fewest changes from the load first. */
function kindsRule(kinds: Rows[], sheet: Pair): string | null {
  for (const pick of CHOICES) {
    const part = kinds.flatMap((k, i) => (pick[i] ? k : []));
    if (fits(part, sheet, pick[3] ? lossHours : minutesHours)) return nameOf(pick);
    if (fits(part, sheet, typedHours)) return `${nameOf(pick)} (hours from the log's hours column)`;
  }
  return null;
}

/** One maintenance code the sheet leaves out. */
function codeRule(counted: Rows, sheet: Pair): string | null {
  for (const code of [...new Set(counted.map((c) => c.row.code))].sort()) {
    const kept = counted.filter((c) => c.row.code !== code);
    if (fits(kept, sheet, minutesHours)) return `sheet leaves out code ${code || '(blank)'}`;
  }
  return null;
}

/** The first rule that reproduces the sheet's pair, or `unexplained`. */
export function explain(d: Difference, rows: Rows): string {
  const sheet = pairOf(d);
  const counted = rows.filter(KINDS[0]![1]).sort(byRow);
  const kinds = KINDS.map(([, test]) => rows.filter(test).sort(byRow));
  const found = rangeRule(counted, sheet) ?? kindsRule(kinds, sheet) ?? codeRule(counted, sheet);
  if (found) return found;
  return sheet.count === counted.length ? 'same count, hours unexplained' : 'unexplained';
}
