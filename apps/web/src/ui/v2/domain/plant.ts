import { fill } from '../../../i18n/fill.js';
import type { Point } from '../points.js';

/** Domain kit: every machine of the plant by cell, in its state now. */
export type MachineState = 'run' | 'risk' | 'down' | 'pm' | 'idle';
/** `code` is unique across the plant: it names the square and keys the picked machine. */
export type MachineData = { code: string; state: MachineState; why: Point[] };
export type CellData = { name: string; machines: MachineData[] };
export type PlantFilter = 'all' | 'down' | 'risk' | 'pm';

export type PlantWords = {
  title: string;
  /** How the map of squares reads aloud as one group. */
  mapLabel: string;
  filterLabel: string;
  filters: Record<PlantFilter, string>;
  states: Record<MachineState, string>;
  hint: string;
  /** A cell's note, one part per state but running (`{n}` is the count), or `cellRunning` when every machine runs. */
  cellCounts: Record<Exclude<MachineState, 'run'>, string>;
  cellRunning: string;
};

const NOTED = ['down', 'risk', 'pm', 'idle'] as const;

/** "1 down · 2 at risk", worst first, each part kept on one line; "all running" only when every machine runs. */
export function cellNote(cell: CellData, words: PlantWords): string {
  const parts = NOTED.flatMap((s) => {
    const n = cell.machines.filter((m) => m.state === s).length;
    return n ? [fill(words.cellCounts[s], { n }).replace(/ /g, '\u00a0')] : [];
  });
  return parts.length ? parts.join(' · ') : words.cellRunning;
}

/**
 * Arrow-key moves over the plant map. `rows` holds the codes a reader can reach, one row per cell (filtered-out
 * machines are left out, so the keys skip them). Left and right run along the whole map, wrapping from one cell's
 * end to the next cell's start; up and down keep the place in the row, clamped to the shorter row; Home and End
 * go to the first and last machine. Any other key, or a code not on the map, moves nowhere.
 */
export function nextTile(rows: string[][], at: string, key: string): string | undefined {
  const filled = rows.filter((r) => r.length > 0);
  const flat = filled.flat();
  const i = flat.indexOf(at);
  if (i < 0) return undefined;
  const r = filled.findIndex((row) => row.includes(at));
  const c = filled[r]!.indexOf(at);
  const inRow = (row: string[] | undefined) => row?.[Math.min(c, row.length - 1)];
  switch (key) {
    case 'ArrowRight':
      return flat[Math.min(i + 1, flat.length - 1)];
    case 'ArrowLeft':
      return flat[Math.max(i - 1, 0)];
    case 'ArrowDown':
      return inRow(filled[r + 1]) ?? at;
    case 'ArrowUp':
      return inRow(filled[r - 1]) ?? at;
    case 'Home':
      return flat[0];
    case 'End':
      return flat[flat.length - 1];
    default:
      return undefined;
  }
}
