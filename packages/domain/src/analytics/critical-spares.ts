import type { FailureEvent } from './standard-kpis.js';
import { spareNames } from './team-focus-spares.js';

/**
 * The critical spares of one machine (ticket 67, R10): the parts its failure reports name, read through 43c's
 * `spareNames` seam, keyed with their digits kept, ranked by uses and then by the downtime they caused. The log is
 * free text, so the key is deliberately literal: the whole cell is one part unless a trailing quantity parenthesis
 * says otherwise. "No" and "Yes" are answers to the spare column, not parts (the fixture writes them 31 times), and
 * a bare number or a sentence stays one entry rather than being invented into several.
 */

/** The page prints five, the same limit 43's spares lane keeps; a machine can name many more. */
export const SPARE_LIMIT = 5;

/** The platform's spare-name stop words, plus "yes": a size, a count, a filler or an answer never names a part. */
const PART_STOP: ReadonlySet<string> = new Set(
  'no any nil na none nos pcs pc mm kg x c a the of and set new old yes'.split(' '),
);

/** The part's cleaned spelling: trimmed, with a trailing quantity parenthesis removed and nothing else. */
function cleaned(name: string): string {
  const text = name
    .trim()
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim();
  return text === '' ? name.trim() : text;
}

/**
 * The part's key: the cleaned text lowercased, every character that is not a letter or a digit turned into a space,
 * split, the stop words dropped, the tokens sorted and joined. Unlike 43c's key it keeps digits, so 6205 and 6305
 * are different parts.
 */
export function partKey(name: string): string {
  return cleaned(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '' && !PART_STOP.has(word))
    .sort()
    .join(' ');
}

/** One part on a machine's reports: its label, uses, hours and last date, and the reports that named it. */
export interface PartUse {
  name: string;
  uses: number;
  /** Recorded downtime hours; a NO DT report contributed none, exactly as 48's MTTR counts it. */
  downtimeHours: number;
  lastOn: string | null;
  /** The distinct reports that named it, in date order: the drill behind the row. */
  tickets: string[];
}

/** One spelling's tally, so the label can be the commonest one and a tie can fall to the earliest report. */
interface Spelling {
  count: number;
  first: number;
}

/** One part as it is being read: the key's own tally, before the label is chosen. */
interface Tally {
  uses: number;
  hours: number;
  lastOn: string | null;
  spellings: Map<string, Spelling>;
  tickets: string[];
}

/** The commonest cleaned spelling; a tie goes to the spelling the earliest report wrote. */
function labelOf(spellings: ReadonlyMap<string, Spelling>): string {
  return (
    [...spellings.entries()].sort(
      (left, right) => right[1].count - left[1].count || left[1].first - right[1].first,
    )[0]?.[0] ?? ''
  );
}

/**
 * The machine's parts, ranked: uses descending, then downtime descending, then the key ascending. A part named
 * twice on one report is one use and one downtime contribution; a NO DT report is one use and zero hours.
 */
export function partsOf(events: readonly FailureEvent[]): PartUse[] {
  const ordered = [...events].sort(
    (left, right) =>
      left.report.date.localeCompare(right.report.date) ||
      left.report.id.localeCompare(right.report.id),
  );
  const tallies = new Map<string, Tally>();
  ordered.forEach((event, sequence) => {
    const seen = new Set<string>();
    for (const raw of spareNames(event.report)) {
      const key = partKey(raw);
      if (key === '' || seen.has(key)) continue;
      seen.add(key);
      const tally = tallies.get(key) ?? {
        uses: 0,
        hours: 0,
        lastOn: null,
        spellings: new Map<string, Spelling>(),
        tickets: [],
      };
      tally.uses += 1;
      tally.hours += event.hours;
      if (tally.lastOn === null || event.report.date > tally.lastOn) {
        tally.lastOn = event.report.date;
      }
      const name = cleaned(raw);
      const spelling = tally.spellings.get(name) ?? { count: 0, first: sequence };
      spelling.count += 1;
      tally.spellings.set(name, spelling);
      if (!tally.tickets.includes(event.ticket.id)) tally.tickets.push(event.ticket.id);
      tallies.set(key, tally);
    }
  });
  return [...tallies.entries()]
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        right.uses - left.uses || right.hours - left.hours || leftKey.localeCompare(rightKey),
    )
    .map(([, tally]) => ({
      name: labelOf(tally.spellings),
      uses: tally.uses,
      downtimeHours: tally.hours,
      lastOn: tally.lastOn,
      tickets: tally.tickets,
    }));
}

/** One row of the machine page's spares table (the frozen value shape). */
export interface SpareRow {
  name: string;
  uses: number;
  downtimeHours: number;
  lastOn: string | null;
}

/** The top five rows the page prints, and how many distinct parts the machine named. */
export function sparesBlock(parts: readonly PartUse[]): { rows: SpareRow[]; total: number } {
  return {
    rows: parts.slice(0, SPARE_LIMIT).map(({ name, uses, downtimeHours, lastOn }) => ({
      name,
      uses,
      downtimeHours,
      lastOn,
    })),
    total: parts.length,
  };
}

/** The reports behind the listed parts, each once: the drill the spares section opens. */
export function spareDrill(parts: readonly PartUse[]): string[] {
  const ids = new Set<string>();
  for (const part of parts.slice(0, SPARE_LIMIT)) for (const id of part.tickets) ids.add(id);
  return [...ids];
}
