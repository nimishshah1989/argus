import { fleetRows } from './a9-forecast-sim.js';
import { effectiveHours } from './rows.js';
import type { EngineData, ReportRow } from './types.js';

/**
 * The spares Team Focus asks the stores to keep ready (ticket 43, packet 43b): the parts written again and again on
 * at least two machines, the five used most. The shared `ReportRow.spares` list names every spare on the row; a row
 * written before that seam carries one `spareUsed`, which the loader and the legacy seed join with ", ".
 */

/** A part is kept in stores when it was used this often on this many machines; the page shows five. */
const PART_MIN = 3;
const PART_MACHINES = 2;
const PART_LIMIT = 5;

/** The platform's spare-name stop words; a size, a count or a filler word never names a part. */
const PART_STOP: ReadonlySet<string> = new Set(
  'no any nil na none nos pcs pc mm kg x c a the of and set new old'.split(' '),
);

/** Every spare name a row recorded: the shared seam's list, else the live field split on the seed's ", ". */
export function spareNames(report: ReportRow): string[] {
  if (report.spares !== undefined) {
    return report.spares.map((name) => name.trim()).filter((name) => name !== '');
  }
  return (report.spareUsed ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/** The platform's part-name key: lowercased letters, stop words and one-letter words dropped, de-duplicated, sorted. */
function partKey(name: string): string {
  const words = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !PART_STOP.has(word));
  return words.length === 0 ? '' : [...new Set(words)].sort().join(' ');
}

/** Whether a row named a part the stores could hold: a size or a "No" is not a part. */
export const hasPart = (report: ReportRow): boolean =>
  spareNames(report).some((name) => partKey(name) !== '');

/** The part's printed name: the commonest raw spelling, with parentheses and any word carrying a digit removed. */
function partLabel(raw: string): string {
  return (
    raw
      .replace(/\(.*?\)/g, ' ')
      .split(/\s+/)
      .filter((word) => word !== '' && !/\d/.test(word) && !PART_STOP.has(word))
      .join(' ') || raw
  );
}

/** One part the plant keeps using: its key, uses, machines, hours and raw spellings. */
interface PartUse {
  readonly key: string;
  n: number;
  readonly machines: Set<string>;
  hours: number;
  readonly names: Map<string, number>;
}

/** One lane D action: its computed title and stake, and no machine to open. */
export interface SpareAction {
  readonly key: string;
  readonly lane: 'D';
  readonly mid?: undefined;
  readonly title: string;
  readonly stake: number;
}

/** Lane D: parts written on three or more jobs across two or more machines, the five used most. */
export function laneD(data: EngineData, months: number): SpareAction[] {
  const parts = new Map<string, PartUse>();
  for (const row of fleetRows(data)) {
    for (const raw of spareNames(row.report)) {
      const key = partKey(raw);
      if (key === '') continue;
      const part = parts.get(key) ?? {
        key,
        n: 0,
        machines: new Set<string>(),
        hours: 0,
        names: new Map<string, number>(),
      };
      part.n += 1;
      part.machines.add(row.report.machineId);
      part.hours += effectiveHours(row.report);
      const name = raw.trim().toLowerCase();
      part.names.set(name, (part.names.get(name) ?? 0) + 1);
      parts.set(key, part);
    }
  }
  return [...parts.values()]
    .filter((part) => part.n >= PART_MIN && part.machines.size >= PART_MACHINES)
    .sort((left, right) => right.n - left.n)
    .slice(0, PART_LIMIT)
    .map((part) => {
      const raw =
        [...part.names.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? part.key;
      return {
        key: `spare|${part.key}`,
        lane: 'D',
        title: `Keep ${partLabel(raw)} ready in stores`,
        stake: part.hours / months,
      };
    });
}
