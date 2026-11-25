import type { Sheet } from '@uptimo/shared/xlsx';
import type { BarSpec, ScatterSpec } from '../../../ui/chart/chart-spec.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import type { QPoint, QuadKey, Split } from '../../../ui/v2/quadrant.js';
import type { RankedRow } from '../../../ui/v2/ranked-bars.js';
import type { Translate } from '../figures/read.js';
import type { ProblemAnalysisModel } from './model.js';

/**
 * The engine bar "Which problems cost the most?" as `RankedBars` rows (ADR 0043 §2), in the engine's order (the kit
 * ranks them). Row i pairs `spec.categories[i]` with `spec.series[0].values[i]`:
 * - a value that is missing (series absent or shorter than the categories) or not finite (NaN, ±Infinity) drops that
 *   row; a category with no value is dropped too;
 * - `key` = the category exactly as the engine printed it;
 * - `label` = the category with one trailing engine share removed (`/\s*\(\d+(?:\.\d+)?%\)$/`, e.g.
 *   "Coolant leakage  (8%)" → "Coolant leakage"), because `RankedBars` prints its own share; nothing else in the
 *   label changes;
 * - `value` = the engine's number; `valueText` = `exact(value)` (`ui/v2/format.ts`); no `countText`, `moneyText` or
 *   `rest`.
 */
export function costRows(spec: BarSpec): RankedRow[] {
  void spec;
  throw new Error('not implemented');
}

/**
 * The engine scatter "Often, or long?" as `Quadrant` points (ADR 0041, 0043): one per `spec.points` entry, in order,
 * `x` = the point's x (how many breakdowns), `y` = its y (average hours each), `label` = `pointName(point)`
 * (`ui/chart/chart-spec.ts`: its code, else its label). A point whose x or y is not finite is dropped.
 * `key` = `point.label`; a label met again gets `${label}#${k}` where k is its occurrence (2 for the second, 3 for the
 * third…), so keys stay unique. Never mutates `spec`.
 */
export function quadPoints(spec: ScatterSpec): QPoint[] {
  void spec;
  throw new Error('not implemented');
}

/**
 * Where the split lines cross: the plain mean of `x` and the plain mean of `y` over the points whose x and y are both
 * finite ("more than the average"). No such point → `{ x: 0, y: 0 }`. Never re-rounded.
 */
export function meanSplit(points: readonly QPoint[]): Split {
  void points;
  throw new Error('not implemented');
}

/**
 * The four quadrant names for Problem Analysis, where x is how often and y is how long: hh → `insight.quad.often-long`,
 * hl → `insight.quad.often-short`, lh → `insight.quad.rare-long`, ll → `insight.quad.rare-short`, each read with `t`.
 */
export function quadNames(t: Translate): Record<QuadKey, string> {
  void t;
  throw new Error('not implemented');
}

/**
 * Printed tables as workbook sheets (ADR 0036 R6, ADR 0041), one per table, in the given order:
 * - rows: the header labels first, then one row per table row, the cell's printed `text`; in a column whose header is
 *   `numeric`, a cell whose text is a plain number (`/^-?\d[\d,]*(\.\d+)?$/`, Indian or western grouping) becomes that
 *   exact number with the commas removed ("1,23,456.75" → 123456.75); every other cell ("8.13%", "—", "", a date)
 *   stays its text. Never re-rounded.
 * - every column is kept as shown (a button column keeps its printed text, e.g. "Accept"); a table with no rows is
 *   its header row alone.
 * - name: the title with each of `[ ] : * ? / \` turned into a space, then trimmed; empty → `Sheet<i+1>` (i the table's
 *   index); cut to 31 characters (then trimmed again). A name already used (case-insensitive) becomes the base cut to
 *   fit plus ` (2)`, ` (3)`… so it stays ≤ 31 characters and unique.
 */
export function tableSheets(tables: readonly PrintedTable[]): Sheet[] {
  void tables;
  throw new Error('not implemented');
}

/**
 * The Download Excel sheets for Problem Analysis: `tableSheets` of its tables as shown, in page order, skipping null
 * ones: groups, families, repeats, unplaced, unrecognised, editor.
 */
export function problemSheets(model: ProblemAnalysisModel): Sheet[] {
  void model;
  throw new Error('not implemented');
}
