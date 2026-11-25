import type { ChartSpec } from '../../../ui/chart/chart-spec.js';
import { exact } from '../../../ui/v2/format.js';
import type { RankedRow } from '../../../ui/v2/ranked-bars.js';

/**
 * Sweep #706 (ADR 0043 §2): every Pareto chart on Shift-calendar KPIs becomes `RankedBars`; the running-total line is
 * dropped and the card keeps the spec's title as its heading.
 *
 * Which specs are Paretos: `kind: 'pareto'` (bars = `series[0]`) and `kind: 'mixed'` (bars = `bars[0]`; the engine's
 * four breakdown-map Paretos `ch-sk-*` arrive as mixed specs: one bar series plus the "Cumulative %" line, which is
 * ignored). Any other kind → `null` (the View keeps its `ChartCard`).
 *
 * Rows, one per category in the spec's order (RankedBars ranks them, worst first): `key` = the category,
 * `label` = the category, `value` = the bar value at that index, `valueText` = `exact(value)` from `ui/v2/format.ts`
 * (never re-rounded: 307.58 → "307.58", 2021.1 → "2,021.1"). A category whose value is `undefined` or not finite is
 * left out. No `countText`, `moneyText` or `rest`. A Pareto with no bar series or no categories → `[]`.
 */
export function paretoRows(spec: ChartSpec): RankedRow[] | null {
  let bar;
  if (spec.kind === 'pareto') bar = spec.series[0];
  else if (spec.kind === 'mixed') bar = spec.bars[0];
  else return null;
  return spec.categories.flatMap((category, at) => {
    const value = bar?.values[at];
    return value === undefined || !Number.isFinite(value)
      ? []
      : [{ key: category, label: category, value, valueText: exact(value) }];
  });
}
