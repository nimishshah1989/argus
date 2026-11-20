import type { Drill } from '../../../ui/v2/drill.js';
import {
  TREND_WORDS,
  type FitView,
  type ReliabilityView,
} from '../../analytics/reliability-values.js';
import { dayText, type Translate } from '../figures/read.js';
import { engineTable } from '../figures/table.js';
import { commonWords, tableWords } from '../figures/words.js';
import { drillOf, number } from './format.js';
import type { FitModel, MachinePageModel } from './model.js';

/** "Not enough history" with both counts, or the plain sentence that there is no working-hours basis. */
function thinFit(fit: Exclude<FitView, { status: 'fitted' }>, t: Translate): FitModel {
  if (fit.status === 'no_basis')
    return { heading: null, figures: [], lines: [t('analytics.machine.fit.noBasis')], trend: null };
  const counts = { own: number(fit.ownEvents, 0), minimum: number(fit.minimum, 0) };
  return {
    heading: t('analytics.machine.fit.notEnough'),
    figures: [],
    lines: [
      fit.category === null
        ? t('analytics.machine.fit.notEnoughNoCategory', counts)
        : t('analytics.machine.fit.notEnoughDetail', {
            ...counts,
            categoryEvents: number(fit.categoryEvents, 0),
            category: fit.category,
          }),
    ],
    trend: null,
  };
}

/** The fit: its own or its category's numbers, "not enough history", or no working-hours basis. */
export function fitOf(fit: FitView, t: Translate): FitModel {
  if (fit.status !== 'fitted') return thinFit(fit, t);
  const own = fit.basis === 'machine';
  const sample = {
    events: number(fit.events, 0),
    intervals: number(fit.completeIntervals, 0),
    hours: number(fit.censoredHours, 1),
  };
  const hours = t('analytics.machine.fit.hours');
  const q = fit.quartiles;
  return {
    heading: null,
    figures: [
      { id: 'shape', label: t('analytics.machine.fit.shape'), value: number(fit.shape, 2) },
      {
        id: 'scale',
        label: t('analytics.machine.fit.scale'),
        value: number(fit.scale, 1),
        note: hours,
      },
      {
        id: 'mean',
        label: t('analytics.machine.fit.mean'),
        value: number(fit.meanHours, 1),
        note: hours,
      },
    ],
    lines: [
      own
        ? t('analytics.machine.fit.ownFailures')
        : t('analytics.machine.fit.categoryFit', { category: fit.category ?? '' }),
      own
        ? t('analytics.machine.fit.sample', sample)
        : t('analytics.machine.fit.categorySample', { ...sample, own: number(fit.ownEvents, 0) }),
      t('analytics.machine.fit.quartiles', {
        q25: number(q.q25, 1),
        median: number(q.median, 1),
        q75: number(q.q75, 1),
      }),
    ],
    trend: {
      word: t(TREND_WORDS[fit.trend.word]),
      slope: t('analytics.machine.fit.trend', {
        beta: number(fit.trend.beta, 2),
        n: number(fit.trend.n, 0),
      }),
    },
  };
}

/** The reliability block: the fit, or the one line that says why there is none. */
export function reliabilityBlock(
  view: ReliabilityView | null,
  note: string,
  machineId: string,
  t: Translate,
): MachinePageModel['reliability'] {
  const title = t('analytics.machine.reliability');
  return {
    title,
    note: view === null ? note : null,
    fit: view === null ? null : fitOf(view.fit, t),
    drill: view === null ? undefined : fitDrill(view, machineId, title, t),
  };
}

const fitDrill = (
  view: ReliabilityView,
  machineId: string,
  title: string,
  t: Translate,
): Drill | undefined => drillOf({ machineId, part: 'fit', ids: view.drill.fit }, title, t);

/** The critical spares: the ranked table, "15 parts, 5 shown", and the empty line that offers no link. */
export function sparesBlock(
  view: ReliabilityView | null,
  note: string,
  machineId: string,
  t: Translate,
): MachinePageModel['spares'] {
  const title = t('analytics.machine.spares');
  const rows = view?.spares.rows ?? [];
  const total = view?.spares.total ?? null;
  const absent = t('analytics.machine.notAvailable');
  const table =
    rows.length === 0
      ? null
      : engineTable(
          {
            title,
            header: [
              t('analytics.machine.spares.part'),
              t('analytics.machine.spares.uses'),
              t('analytics.machine.spares.hours'),
              t('analytics.machine.spares.lastUsed'),
            ],
            rows: rows.map((row) => [
              row.name,
              number(row.uses, 0),
              number(row.downtimeHours, 1),
              row.lastOn === null ? absent : dayText(row.lastOn),
            ]),
          },
          { id: 'spares', title, words: tableWords(commonWords(t), title, rows.length) },
        );
  return {
    title,
    note: view === null ? note : rows.length === 0 ? t('analytics.machine.spares.none') : null,
    ranked: t('analytics.machine.spares.ranked'),
    table,
    topLine:
      total !== null && total > rows.length
        ? t('analytics.machine.spares.topFive', {
            total: number(total, 0),
            shown: number(rows.length, 0),
          })
        : null,
    drill:
      view === null
        ? undefined
        : drillOf({ machineId, part: 'spares', ids: view.drill.spares }, title, t),
  };
}
