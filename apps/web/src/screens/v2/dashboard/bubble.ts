import { fill } from '../../../i18n/fill.js';
import { readable } from '../../../ui/v2/format.js';
import { catOf, numberIn, type Translate } from '../figures/read.js';
import { NO_VALUE } from './cards.js';
import type { AgeBand, BubbleMachine, BubbleModel, PlantMachine } from './model.js';
import type { BubblePoint } from './tables.js';

const oneDecimal = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Bhavin's age bands, in years: from (inclusive) to (exclusive). */
const BANDS: { key: AgeBand; from: number; to: number; label: string }[] = [
  { key: '0', from: 0, to: 5, label: 'v2d.bubble.age.0' },
  { key: '1', from: 5, to: 10, label: 'v2d.bubble.age.1' },
  { key: '2', from: 10, to: 15, label: 'v2d.bubble.age.2' },
  { key: '3', from: 15, to: 20, label: 'v2d.bubble.age.3' },
  { key: '4', from: 20, to: Infinity, label: 'v2d.bubble.age.4' },
];

/** The band an age the engine printed ("18 yrs") falls in; a machine with no known age is `u`. */
export function bandOf(age: string | null): AgeBand {
  const years = age === null ? null : numberIn(age);
  if (years === null) return 'u';
  return BANDS.find((band) => years >= band.from && years < band.to)?.key ?? 'u';
}

/** The tooltip's lines: the machine's type (the colour alone does not say it), then Bhavin's order: model, age, breakdowns, downtime hours and repair time. */
function tipOf(p: BubblePoint, category: string | null, t: Translate): string[] {
  const dash = (value: string | null) => value ?? NO_VALUE;
  return [
    fill(t('v2d.bubble.tip.type'), { value: dash(category) }),
    fill(t('v2d.bubble.tip.model'), { value: dash(p.model) }),
    fill(t('v2d.bubble.tip.age'), { value: dash(p.age) }),
    fill(t('v2d.bubble.tip.breakdowns'), { value: p.y }),
    fill(t('v2d.bubble.tip.hours'), {
      value: p.x >= 100_000 ? readable(p.x) : twoDecimals.format(p.x),
    }),
    fill(t('v2d.bubble.tip.mttr'), {
      value: p.mttr === null ? NO_VALUE : oneDecimal.format(p.mttr),
    }),
  ];
}

/** The words of the plot's controls and filters. */
function wordsOf(t: Translate): BubbleModel['words'] {
  return {
    xLabel: t('analytics.content.bubble.xLabel'),
    yLabel: t('analytics.content.bubble.yLabel'),
    zoomIn: t('v2d.bubble.zoomIn'),
    zoomOut: t('v2d.bubble.zoomOut'),
    reset: t('v2d.bubble.zoomReset'),
    aria: t('v2d.bubble.aria'),
    empty: t('v2d.bubble.empty'),
    all: t('v2d.bubble.all'),
    cell: t('v2d.bubble.filter.cell'),
    category: t('v2d.bubble.filter.category'),
    age: t('v2d.bubble.filter.age'),
    resetFilters: t('v2d.bubble.filter.reset'),
    shown: t('v2d.bubble.shown'),
    bands: [
      ...BANDS.map((band) => ({ key: band.key, label: t(band.label) })),
      { key: 'u' as const, label: t('v2d.bubble.age.u') },
    ],
  };
}

/**
 * Every machine of the engine's bubble chart as a dot with its tooltip written out (model, age, breakdowns, hours and
 * repair time), the type colour it wears and what its filters read. A machine the plant no longer lists keeps its
 * bubble but is a dash and opens nothing: its database id never reaches the screen.
 */
export function bubbleOf(
  points: readonly BubblePoint[],
  plant: readonly PlantMachine[],
  t: Translate,
): BubbleModel {
  const byId = new Map(plant.map((m) => [m.id, m]));
  const dots = points.map((p, at): BubbleMachine => {
    const machine = byId.get(p.id);
    const category = machine?.category ?? null;
    return {
      id: machine?.code ?? `unlisted-${at}`,
      title: machine?.code ?? NO_VALUE,
      x: p.x,
      y: p.y,
      r: p.r,
      ...(category === null ? {} : { cat: catOf(category) }),
      tip: tipOf(p, category, t),
      opens: machine !== undefined,
      category,
      cell: machine?.cell ?? null,
      band: bandOf(p.age),
    };
  });
  return { dots, words: wordsOf(t) };
}

/** What the three filters hold: an empty string is "all". */
export type BubbleFilters = { cell: string; category: string; age: string };
export const NO_FILTERS: BubbleFilters = { cell: '', category: '', age: '' };

/** The dots that pass every filter that is set. */
export function filterDots(dots: readonly BubbleMachine[], f: BubbleFilters): BubbleMachine[] {
  return dots.filter(
    (d) =>
      (f.cell === '' || d.cell === f.cell) &&
      (f.category === '' || d.category === f.category) &&
      (f.age === '' || d.band === f.age),
  );
}

/** The values a filter can take among the dots, sorted: the plant's own cells and types. */
export function optionsOf(
  dots: readonly BubbleMachine[],
  pick: (d: BubbleMachine) => string | null,
): { key: string; label: string }[] {
  return [...new Set(dots.flatMap((d) => pick(d) ?? []))]
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((key) => ({ key, label: key }));
}
