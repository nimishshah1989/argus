import type { Sheet } from '@uptimo/shared/xlsx';
import { pointName, type BarSpec, type ScatterSpec } from '../../../ui/chart/chart-spec.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { exact } from '../../../ui/v2/format.js';
import type { QPoint, QuadKey, Split } from '../../../ui/v2/quadrant.js';
import type { RankedRow } from '../../../ui/v2/ranked-bars.js';
import type { Translate } from '../figures/read.js';
import type { ProblemAnalysisModel } from './model.js';

const TRAILING_SHARE = /\s*\(\d+(?:\.\d+)?%\)$/;
const PLAIN_NUMBER = /^-?\d[\d,]*(\.\d+)?$/;
const NAME_LIMIT = 31;

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
  const values = spec.series[0]?.values ?? [];
  return spec.categories.flatMap((category, at) => {
    const value = values[at];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    return [
      {
        key: category,
        label: category.replace(TRAILING_SHARE, ''),
        value,
        valueText: exact(value),
      },
    ];
  });
}

/**
 * The engine scatter "Often, or long?" as `Quadrant` points (ADR 0041, 0043): one per `spec.points` entry, in order,
 * `x` = the point's x (how many breakdowns), `y` = its y (average hours each), `label` = `pointName(point)`
 * (`ui/chart/chart-spec.ts`: its code, else its label). A point whose x or y is not finite is dropped.
 * `key` = `point.label`; a label met again gets `${label}#${k}` where k is its occurrence (2 for the second, 3 for the
 * third…), so keys stay unique. Never mutates `spec`.
 */
export function quadPoints(spec: ScatterSpec): QPoint[] {
  const seen = new Map<string, number>();
  return spec.points.flatMap((point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
    const k = (seen.get(point.label) ?? 0) + 1;
    seen.set(point.label, k);
    const key = k === 1 ? point.label : `${point.label}#${k}`;
    return [{ key, label: pointName(point), x: point.x, y: point.y }];
  });
}

/**
 * Where the split lines cross: the plain mean of `x` and the plain mean of `y` over the points whose x and y are both
 * finite ("more than the average"). No such point → `{ x: 0, y: 0 }`. Never re-rounded.
 */
export function meanSplit(points: readonly QPoint[]): Split {
  const ok = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (ok.length === 0) return { x: 0, y: 0 };
  const mean = (pick: (p: QPoint) => number) => ok.reduce((sum, p) => sum + pick(p), 0) / ok.length;
  return { x: mean((p) => p.x), y: mean((p) => p.y) };
}

/**
 * The four quadrant names for Problem Analysis, where x is how often and y is how long: hh → `insight.quad.often-long`,
 * hl → `insight.quad.often-short`, lh → `insight.quad.rare-long`, ll → `insight.quad.rare-short`, each read with `t`.
 */
export function quadNames(t: Translate): Record<QuadKey, string> {
  return {
    hh: t('insight.quad.often-long'),
    hl: t('insight.quad.often-short'),
    lh: t('insight.quad.rare-long'),
    ll: t('insight.quad.rare-short'),
  };
}

/** A sheet name Excel accepts: no `[]:*?/\`, ≤ 31 characters, unique (case-insensitive) among `used`. */
function sheetName(title: string, index: number, used: Set<string>): string {
  const base = title.replace(/[[\]:*?/\\]/g, ' ').trim() || `Sheet${index + 1}`;
  let name = base.slice(0, NAME_LIMIT).trim();
  for (let n = 2; used.has(name.toLowerCase()); n += 1) {
    const suffix = ` (${n})`;
    name = `${base.slice(0, NAME_LIMIT - suffix.length).trim()}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
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
  const used = new Set<string>();
  return tables.map((table, index) => ({
    name: sheetName(table.title, index, used),
    rows: [
      table.header.map((h) => h.label),
      ...table.rows.map((row) =>
        row.map((cell, at) =>
          table.header[at]?.numeric && PLAIN_NUMBER.test(cell.text)
            ? Number(cell.text.replace(/,/g, ''))
            : cell.text,
        ),
      ),
    ],
  }));
}

/**
 * The Download Excel sheets for Problem Analysis: `tableSheets` of its tables as shown, in page order, skipping null
 * ones: groups, families, repeats, unplaced, unrecognised, editor.
 */
export function problemSheets(model: ProblemAnalysisModel): Sheet[] {
  const { groups, families, repeats, unplaced, unrecognised, editor } = model;
  return tableSheets(
    [groups, families, repeats, unplaced, unrecognised, editor].filter((t) => t !== null),
  );
}
