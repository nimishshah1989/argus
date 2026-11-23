import type { ChartMeaning, ChartSpec } from '../../ui/chart/use-chart.js';

type BarSpec = Extract<ChartSpec, { kind: 'bar' }>;

/**
 * What each engine chart MEANS, so it reads without its legend (UX-RULES 20, 32a). The engine's chart id is the key and
 * every id the engine emits is listed (a test fails for a new one), so a chart is never left neutral by forgetting it.
 * The meanings run in the engine's series order: hours, counts and money lost are `loss`, planned maintenance is
 * `planned`, time kept running is `gain`. A "by category" chart has more categories than the five machine-type colours,
 * so it is a ranking: horizontal, the category's name on its row, the worst first, and the three worst bars (the ones
 * that have a value) wear the loss colour while the rest stay neutral. Worst is the largest for hours and counts lost,
 * and the smallest for MTBF (time between failures: more is better). `NEUTRAL` is a decision too: a chart of people,
 * energy load, two machines side by side, or two measures that differ by axis, where no colour means anything.
 */
type Meant = { meanings?: ChartMeaning[]; ranked?: 'worst-high' | 'worst-low'; unit?: string };

const LOSS: Meant = { meanings: ['loss'] };
const GAIN: Meant = { meanings: ['gain'] };
const NEUTRAL: Meant = {};
const RANKED: Meant = { meanings: ['loss'], ranked: 'worst-high' };
/** The bars the loss colour marks. */
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
  // More time between failures is better, so the worst categories are the lowest and the ranking starts there.
  'ch-a3-catmtbf': { meanings: ['loss'], ranked: 'worst-low' },
  'ch-a3-cellmttr': LOSS,
  'ch-a3-cellmtbf': GAIN,
  'ch-a3-agemttr': LOSS,
  'ch-a3-agemtbf': GAIN,
  'ch-a3-planttrend': { meanings: ['loss', 'gain'] },
  'ch-a4-count': NEUTRAL,
  'ch-a8-combo': NEUTRAL,
  'ch-a8-scatter': NEUTRAL,
  'ch-a8-mix': NEUTRAL,
  'ch-a9-map': NEUTRAL, // rated by its own bands
  'ch-fc': NEUTRAL, // coloured by the forecast's own bands
  'ch-fl': NEUTRAL, // one line per forecasting method
  'ch-prob-pareto': LOSS,
  'ch-prob-scatter': NEUTRAL,
  // The shift-calendar KPIs' four Paretos: the bars are downtime hours, the line is the running share.
  'ch-sk-machine': LOSS,
  'ch-sk-cell': LOSS,
  'ch-sk-code': LOSS,
  'ch-sk-shift': LOSS,
  'ch-mm': LOSS, // money lost by problem
  'ch-ry-pareto': LOSS, // downtime hours by machine, with the running share
  'ch-ry-month': NEUTRAL, // breakdowns and downtime hours: two measures told apart by axis
  'ch-rp-daily': NEUTRAL, // breakdowns and hours by day, this month and last
  'ch-rp-12m': NEUTRAL, // breakdowns and downtime hours: two measures told apart by axis
  'ch-cmp-code': NEUTRAL, // two machines side by side
  'ch-cmp-month': NEUTRAL,
  'ch-oem-h': NEUTRAL,
  'ch-oem-r': NEUTRAL,
  'ch-dash-bdfree': NEUTRAL,
  'ch-dash-timeline': NEUTRAL,
  'ch-dash-bubble': NEUTRAL,
};

/** Whether the engine's chart `id` has a decision here (a meaning, a ranking or an explicit neutral). */
export const hasMeaning = (id: string): boolean => id in MEANT;

/** The series with their meaning set, in the engine's order. */
const meant = <S extends { meaning?: ChartMeaning }>(
  series: S[],
  meanings: ChartMeaning[] = [],
): S[] => series.map((s, at) => (meanings[at] === undefined ? s : { ...s, meaning: meanings[at] }));

/**
 * The bars worst first (a gap last), the categories with them; ties keep the engine's order. The first `TOP` are marked
 * and the chart reads down the side: horizontal, each category's name on its row.
 */
function ranking(spec: BarSpec, worst: 'worst-high' | 'worst-low'): BarSpec {
  const [first] = spec.series;
  if (first === undefined || spec.series.length !== 1) return spec;
  const sign = worst === 'worst-high' ? -1 : 1;
  const gap = worst === 'worst-high' ? -Infinity : Infinity;
  const order = spec.categories
    .map((_, at) => at)
    .sort((a, b) => sign * ((first.values[a] ?? gap) - (first.values[b] ?? gap)) || a - b);
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
      return how.ranked === undefined ? meaning : ranking(meaning, how.ranked);
    }
    if (spec.kind === 'line') return { ...spec, series: meant(spec.series, how.meanings) };
    if (spec.kind === 'mixed') return { ...spec, bars: meant(spec.bars, how.meanings) };
    return spec;
  });
}
