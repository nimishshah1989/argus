import { fill } from '../../../i18n/fill.js';
import type { EntityChipProps } from '../entity-chip.js';
import type { IconName } from '../icons.js';
import type { Point } from '../points.js';

/** Domain kit: every machine of the plant by cell, in its state now. */
export type MachineState = 'run' | 'risk' | 'down' | 'pm' | 'idle';
/**
 * One machine as every v2 screen sees it: on the plant map, in the machines table, in its drawer. `code` is unique
 * across the plant. `cat` is its type's fixed colour (1 to 5), the same on every screen.
 */
export type MachineData = {
  code: string;
  name: string;
  typeLabel: string;
  cat: 1 | 2 | 3 | 4 | 5;
  cell: string;
  state: MachineState;
  /** Breakdown hours this month: the engine's figure, and the number that sorts it. */
  hours: { shown: string; value: number };
  /** Breakdowns in the last 90 days. */
  stops: number;
  /** Breakdown hours a week, the last 12 weeks, oldest first. */
  trend: number[];
  why: Point[];
};

/** The icon a state wears on its tile, its tag and its drawer; running needs none. */
export const STATE_ICON: Record<MachineState, IconName | undefined> = {
  run: undefined,
  risk: 'alert',
  down: 'stop',
  pm: 'wrench',
  idle: 'pause',
};
/** A 12-week trend's tone: rising breakdown hours are a loss, falling or flat a gain. */
export const trendTone = (values: number[]): 'gain' | 'loss' =>
  (values[values.length - 1] ?? 0) > (values[0] ?? 0) ? 'loss' : 'gain';

/** The tag tone a state wears. */
export const STATE_TONE = {
  run: 'gain',
  risk: 'risk',
  down: 'loss',
  pm: 'plan',
  idle: 'neutral',
} as const;
export type CellData = { name: string; machines: MachineData[] };

/** A machine as a chip: its code in its type's colour. */
export const machineChip = (m: MachineData): EntityChipProps => ({
  kind: 'machine',
  id: m.code,
  label: m.code,
  cat: m.cat,
});
/** A cell as a chip; a machine knows its cell by name, and a cell is asked for by its name. */
export const cellChip = (name: string): EntityChipProps => ({
  kind: 'cell',
  id: name,
  label: name,
});
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
