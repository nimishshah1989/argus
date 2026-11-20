import type { FiguresReply } from '@uptimo/shared/analytics';
import { kpiCard, sentence, verdictOf } from '../figures/point.js';
import {
  numberIn,
  pagesOf,
  sourceLine,
  type RegisterKpi,
  type Translate,
} from '../figures/read.js';
import { engineTable, type TableModel } from '../figures/table.js';
import { commonWords, tableWords } from '../figures/words.js';
import type { AgeModel } from './model.js';

type Band = { total: RegisterKpi; average: RegisterKpi };

/** The engine sends the bands twice, as totals then as averages per machine, in the same order: each band's pair. */
function bandsOf(kpis: RegisterKpi[]): Band[] {
  const half = kpis.length / 2;
  if (!Number.isInteger(half) || half === 0) return [];
  const pairs = kpis.slice(0, half).map((total, i) => ({ total, average: kpis[half + i]! }));
  return pairs.every(({ total, average }) => total.label === average.label) ? pairs : [];
}

const hoursOf = (band: Band): number => numberIn(band.average.value) ?? Number.NEGATIVE_INFINITY;

function bandTable(bands: Band[], t: Translate): TableModel {
  const c = commonWords(t);
  const title = t('v2m.age.bands');
  return engineTable(
    {
      title,
      header: [
        t('v2m.age.band'),
        t('v2m.age.hours'),
        t('v2m.age.fleet'),
        t('v2m.age.average'),
        t('v2m.age.how'),
      ],
      rows: bands.map(({ total, average }) => [
        total.label,
        total.value,
        total.sub ?? '',
        average.value,
        average.sub ?? '',
      ]),
    },
    { id: 'bands', title, words: tableWords(c, title, bands.length) },
  );
}

/** The age analysis from the engine's `a8-age` figure; null while the engine has not computed it. */
export function ageModel(reply: FiguresReply, t: Translate): AgeModel | null {
  const bands = bandsOf(pagesOf(reply, 'a8-age')?.[0]?.kpis ?? []);
  if (bands.length === 0) return null;
  const c = commonWords(t);
  const source = sourceLine(c.source, reply.asOf);
  const worst = bands.reduce((a, b) => (hoursOf(b) > hoursOf(a) ? b : a));
  const first = bands[0]!;
  const formula = t('analytics.guide.age.formula');
  return {
    verdict: verdictOf(
      sentence(t('v2m.age.headline'), {
        band: worst.average.label,
        hours: worst.average.value,
        youngBand: first.average.label,
        youngHours: first.average.value,
      }),
      t('analytics.guide.age.body2'),
      [t('analytics.guide.age.body1'), formula],
    ),
    kpis: bands.map(({ average }, i) => kpiCard(`band-${i}`, 'clock', average, formula)),
    bands: bandTable(bands, t),
    source,
    words: { why: c.why },
  };
}
