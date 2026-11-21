import type { ChartMeaning, ChartSpec } from '../../ui/chart/use-chart.js';

type BarSpec = Extract<ChartSpec, { kind: 'bar' }>;

/**
 * What each engine chart MEANS, so it reads without its legend (UX-RULES 20). The engine's chart id is the key; the
 * meanings run in its series order. Hours and counts lost are `loss`, planned maintenance is `planned`, time kept
 * running is `gain`. A "by category" chart has more categories than the five type colours, so it is a ranking
 * instead: horizontal, the category's name on its row, worst first, the top three in the accent and the rest quiet.
 * A chart not listed here (people counts, energy load, forecasts with their own bands) stays neutral.
 */
type Meant = { meanings?: ChartMeaning[]; ranked?: true; unit?: string };

const LOSS: Meant = { meanings: ['loss'] };
const GAIN: Meant = { meanings: ['gain'] };
const RANKED: Meant = { ranked: true };
/** The bars the accent marks. */
const TOP = 3;

const MEANT: Record<string, Meant> = {
  'ch-a1-cell': { meanings: ['loss', 'planned'], unit: '%' },
  'ch-a1-trend': { meanings: ['loss', 'planned'] },
  'ch-a2-cathrs': RANKED,
  'ch-a2-catcnt': RANKED,
  'ch-a2-catavghrs': RANKED,
  'ch-a2-catavgcnt': RANKED,
  'ch-a2-cellhrs': LOSS,
  'ch-a2-cellcnt': LOSS,
  'ch-a2-cellavghrs': LOSS,
  'ch-a2-cellavgcnt': LOSS,
  'ch-a3-catmttr': RANKED,
  'ch-a3-catmtbf': RANKED,
  'ch-a3-cellmttr': LOSS,
  'ch-a3-cellmtbf': GAIN,
  'ch-a3-agemttr': LOSS,
  'ch-a3-agemtbf': GAIN,
  'ch-a3-planttrend': { meanings: ['loss', 'gain'] },
  'ch-prob-pareto': LOSS,
  // The shift-calendar KPIs' four Paretos: the bars are downtime hours, the line is the running share.
  'ch-sk-machine': LOSS,
  'ch-sk-cell': LOSS,
  'ch-sk-code': LOSS,
  'ch-sk-shift': LOSS,
};

/** The series with their meaning set, in the engine's order. */
const meant = <S extends { meaning?: ChartMeaning }>(
  series: S[],
  meanings: ChartMeaning[] = [],
): S[] => series.map((s, at) => (meanings[at] === undefined ? s : { ...s, meaning: meanings[at] }));

/** The bars in falling order of their value (a gap last), the categories with them; nothing else changes. */
function ranking(spec: BarSpec): BarSpec {
  const [first] = spec.series;
  if (first === undefined || spec.series.length !== 1) return spec;
  const order = spec.categories
    .map((_, at) => at)
    .sort((a, b) => (first.values[b] ?? -Infinity) - (first.values[a] ?? -Infinity));
  return {
    ...spec,
    categories: order.map((at) => spec.categories[at]!),
    series: [{ ...first, values: order.map((at) => first.values[at]) }],
    horizontal: true,
    highlight: TOP,
  };
}

/** The chart the engine's `id` drew, with the meaning of each series (or its ranking) it is listed with. */
export function withMeaning(id: unknown, specs: ChartSpec[]): ChartSpec[] {
  const how = typeof id === 'string' ? MEANT[id] : undefined;
  if (how === undefined) return specs;
  return specs.map((spec) => {
    if (spec.kind === 'bar') {
      const meaning = {
        ...spec,
        series: meant(spec.series, how.meanings) as typeof spec.series,
        ...(how.unit === undefined ? {} : { unit: how.unit }),
      };
      return how.ranked === true ? ranking(meaning) : meaning;
    }
    if (spec.kind === 'line') return { ...spec, series: meant(spec.series, how.meanings) };
    if (spec.kind === 'mixed') return { ...spec, bars: meant(spec.bars, how.meanings) };
    return spec;
  });
}
