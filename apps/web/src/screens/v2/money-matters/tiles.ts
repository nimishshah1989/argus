import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { TileGroup } from './model.js';

const SCALE: Record<string, number> = { lakh: 1e5, cr: 1e7 };
const RUPEES = /₹\s*(\d[\d,]*(?:\.\d+)?)\s*(lakh|cr)?/;

/** A printed rupee amount as a number: `₹ 72,324`, `₹ 5.72 lakh` (×1e5), `₹ 1.20 cr` (×1e7), with or without " a year". NaN when it is not one. */
export function rupees(printed: string): number {
  const found = RUPEES.exec(printed);
  return found ? Number(found[1]!.replaceAll(',', '')) * (SCALE[found[2] ?? ''] ?? 1) : NaN;
}

const GROUPS: { id: TileGroup['id']; labels: string[] }[] = [
  {
    id: 'cost',
    labels: [
      'Money lost to breakdowns',
      'Same, per year',
      'Could have been added',
      'Open Team Focus actions',
    ],
  },
  {
    id: 'next',
    labels: ['Next month, expected', 'Plan for (80%)', 'Worst case (90%)', 'Average month so far'],
  },
  { id: 'price', labels: ['Throughput per machine-hour', 'Value of one lost hour'] },
];
const PLAIN: Record<string, string> = {
  'Same, per year': 'v2mm.yardstick.year',
  'Average month so far': 'v2mm.yardstick.baseline',
  'Value of one lost hour': 'v2mm.yardstick.rate',
};
const OF_YEAR = new Set([
  'Money lost to breakdowns',
  'Could have been added',
  'Open Team Focus actions',
]);
const VS_AVERAGE = new Set(['Next month, expected', 'Plan for (80%)', 'Worst case (90%)']);

/** The ten engine tiles in their three groups, each with the yardstick it is read against. A tile the engine did not print is left out. */
export function groupsOf(figures: FigureData[], t: TFunction): TileGroup[] {
  const byLabel = new Map(figures.map((figure) => [figure.label, figure]));
  const year = byLabel.get('Same, per year');
  const average = rupees(byLabel.get('Average month so far')?.value ?? '');
  const yardstick = (figure: FigureData): string | undefined => {
    const { label, value } = figure;
    if (OF_YEAR.has(label) && year && rupees(year.value) > 0)
      return fill(t('insight.yardstick.share'), {
        pct: Math.round((rupees(value) / rupees(year.value)) * 100),
        total: year.value,
      });
    if (VS_AVERAGE.has(label) && average > 0) {
      const pct = Math.round(((rupees(value) - average) / average) * 100);
      return t('v2mm.yardstick.vsAverage', {
        delta: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`,
      });
    }
    if (label === 'Throughput per machine-hour')
      return t('v2mm.yardstick.machines', { n: /\d[\d,]*/.exec(figure.sub)?.[0] ?? '' });
    return PLAIN[label] && t(PLAIN[label]);
  };
  return GROUPS.map(({ id, labels }) => ({
    id,
    title: t(`v2mm.group.${id}`),
    figures: labels.flatMap((label) => {
      const figure = byLabel.get(label);
      return figure ? [{ ...figure, yardstick: yardstick(figure) }] : [];
    }),
  }));
}
