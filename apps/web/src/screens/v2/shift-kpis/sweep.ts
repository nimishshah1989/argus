import type { ChartSpec } from '../../../ui/chart/chart-spec.js';
import { exact } from '../../../ui/v2/format.js';
import type { RankedRow } from '../../../ui/v2/ranked-bars.js';

/**
 * Sweep 706 (ADR 0043 §2): every Pareto chart on Shift-calendar KPIs becomes `RankedBars`; the running-total line is
 * dropped and the card keeps the spec's title as its heading.
 *
 * Which specs are Paretos: `kind: 'pareto'` (bars = `series[0]`) and `kind: 'mixed'` (bars = `bars[0]`; the engine's
 * four breakdown-map Paretos `ch-sk-*` arrive as mixed specs: one bar series plus the "Cumulative %" line, which is
 * ignored). Any other kind → `null` (the View keeps its `ChartCard`).
 *
 * Rows, one per category in the spec's order (RankedBars ranks them, worst first): `key` = the category,
 * `label` = the category, `value` = the bar value at that index, `valueText` = `exact(value)` from `ui/v2/format.ts`
 * (never re-rounded: 307.58 → "307.58", 2021.1 → "2,021.1"). A category whose value is `undefined` or not finite is
 * left out. No `countText` or `moneyText`. A Pareto with no bar series or no categories → `[]`.
 *
 * The rest row (ticket 753 fix): the engine prints only the top 15 machines (`PARETO_BARS` in
 * `packages/domain/src/analytics/breakdown-map.ts`) while its "Cumulative %" line is a share of every machine. When a
 * `mixed` spec's line ends under 100 (last finite line value `last`, 0 < last < 100), one more row goes last:
 * `{ key: '__rest', label: restLabel, value, valueText: exact(value), rest: true }` with
 * `value = round2(sum of the kept bar values × (100 / last − 1))`. So each machine's RankedBars share equals the
 * engine's own cumulative step and the half-the-hours divider counts against the whole plant. No rest row when the
 * line ends at 100 or more, has no finite value, or the sum is 0, and never for a `pareto` spec (it has no line).
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
