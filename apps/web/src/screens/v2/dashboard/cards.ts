import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { IconName } from '../../../ui/v2/icons.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import {
  describeChange,
  figureMeasure,
  figurePlaces,
  formatFigure,
  roundMove,
  toneOfChange,
} from '../../../ui/meaning/index.js';
import { FIGURE_LABELS } from '../../analytics/groups.js';
import { COMPARE_DAYS, changeOf, scalarOf, type Change } from '../../analytics/today-change.js';
import type { Translate } from '../figures/read.js';

type Figure = FiguresReply['figures'][number];

export const NO_VALUE = '—';
const ENGINE_DIGITS = 2;
export const dash = (key: string) => `dashboard.${key}`;

/** The three groups of cards, in the order v1 listed the figures; the picture and the table are drawn apart. */
export const GROUPS = [
  {
    id: 'running',
    title: 'v2d.section.running',
    sub: 'v2d.section.running.sub',
    keys: ['fleet-availability', 'plant-bd-pct', 'total-downtime-hours', 'total-breakdowns'],
  },
  {
    id: 'time',
    title: 'v2d.section.time',
    sub: 'v2d.section.time.sub',
    keys: [
      'pm-hours',
      'no-downtime-hours',
      'plant-events',
      'breakdown-free',
      'avg-complaints-per-day',
      'avg-bd-hours-per-day',
      'avg-bd-hours-per-machine',
    ],
  },
  {
    id: 'fleet',
    title: 'v2d.section.fleet',
    sub: 'v2d.section.fleet.sub',
    keys: [
      'total-machines',
      'utilities',
      'dg-sets',
      'cnc-machines',
      'conventional-machines',
      'process-machines',
    ],
  },
] as const;

const ICON: Record<string, IconName> = {
  'fleet-availability': 'gauge',
  'plant-bd-pct': 'gauge',
  'total-downtime-hours': 'clock',
  'total-breakdowns': 'problems',
  'pm-hours': 'wrench',
  'no-downtime-hours': 'check',
  'plant-events': 'alert',
  'breakdown-free': 'check',
  'avg-complaints-per-day': 'list',
  'avg-bd-hours-per-day': 'clock',
  'avg-bd-hours-per-machine': 'machines',
};

/** What each figure covers, said on its card: the span the engine reads for it. */
const COVER: Record<string, string> = {
  'fleet-availability': 'v2d.cover.ytd',
  'plant-bd-pct': 'v2d.cover.ytd',
  'plant-events': 'v2d.cover.ytd',
  'breakdown-free': 'v2d.cover.clean',
  'total-machines': 'v2d.cover.now',
  utilities: 'v2d.cover.now',
  'dg-sets': 'v2d.cover.now',
  'cnc-machines': 'v2d.cover.now',
  'conventional-machines': 'v2d.cover.now',
  'process-machines': 'v2d.cover.now',
};

const WHAT: Record<string, string> = {
  'fleet-availability': 'v2d.fig.fleet-availability.what',
  'plant-bd-pct': 'v2d.fig.plant-bd-pct.what',
  'total-breakdowns': 'v2d.fig.total-breakdowns.what',
  'total-downtime-hours': 'v2d.fig.total-downtime-hours.what',
  'pm-hours': 'v2d.fig.pm-hours.what',
  'no-downtime-hours': 'v2d.fig.no-downtime-hours.what',
  'plant-events': 'v2d.fig.plant-events.what',
  'breakdown-free': 'v2d.fig.breakdown-free.what',
  'avg-complaints-per-day': 'v2d.fig.avg-complaints-per-day.what',
  'avg-bd-hours-per-day': 'v2d.fig.avg-bd-hours-per-day.what',
  'avg-bd-hours-per-machine': 'v2d.fig.avg-bd-hours-per-machine.what',
  'total-machines': 'v2d.fig.total-machines.what',
  utilities: 'v2d.fig.utilities.what',
  'dg-sets': 'v2d.fig.dg-sets.what',
  'cnc-machines': 'v2d.fig.cnc-machines.what',
  'conventional-machines': 'v2d.fig.conventional-machines.what',
  'process-machines': 'v2d.fig.process-machines.what',
};

const MORE: Record<string, string> = {
  'fleet-availability': 'v2d.fig.fleet-availability.more',
  'plant-bd-pct': 'v2d.fig.plant-bd-pct.more',
  'total-breakdowns': 'v2d.fig.total-breakdowns.more',
  'total-downtime-hours': 'v2d.fig.total-downtime-hours.more',
  'pm-hours': 'v2d.fig.pm-hours.more',
  'no-downtime-hours': 'v2d.fig.no-downtime-hours.more',
  'plant-events': 'v2d.fig.plant-events.more',
  'breakdown-free': 'v2d.fig.breakdown-free.more',
  'avg-complaints-per-day': 'v2d.fig.avg-complaints-per-day.more',
  'avg-bd-hours-per-day': 'v2d.fig.avg-bd-hours-per-day.more',
  'avg-bd-hours-per-machine': 'v2d.fig.avg-bd-hours-per-machine.more',
};

export const label = (key: string, t: Translate): string =>
  t(FIGURE_LABELS[key] ?? 'analytics.figure.unknown');

/** The row's way to its rows: every v1 figure that named rows still opens them. */
export function drillOf(figure: Figure, t: Translate): Drill | undefined {
  return figure.drill.ids.length > 0
    ? { figure: figure.key, label: fill(t('v2d.drill'), { figure: label(figure.key, t) }) }
    : undefined;
}

function signed(value: number, text: string): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${text}`;
}

/**
 * The change against the figure 30 days earlier: a verdict for a rate, a quiet amount for a running total (it only
 * rises, so it has no good direction), nothing when the engine holds no earlier figure.
 */
function changeOfCard(
  change: Change | undefined,
  prior: string,
  t: Translate,
): Pick<KpiData, 'delta' | 'period'> {
  if (!change) return { delta: { text: '', up: false, good: true, flat: true }, period: '' };
  const delta = roundMove(change.delta, 2);
  const places = figurePlaces(change.measure, delta);
  if (change.added)
    return {
      delta: {
        text: signed(delta, formatFigure(change.measure, Math.abs(delta), 2, places)),
        up: delta > 0,
        good: true,
        flat: true,
      },
      period: fill(t('v2d.added'), { days: COMPARE_DAYS }),
    };
  const text =
    change.measure.unit === 'percent'
      ? signed(
          delta,
          `${formatFigure({ ...change.measure, unit: 'count' }, Math.abs(delta), 2, places)} ${t('analytics.unit.points')}`,
        )
      : describeChange(change.measure, delta).text;
  const tone = toneOfChange(change.measure.better, delta);
  return {
    delta: { text, up: delta > 0, good: tone !== 'bad', flat: tone === 'neutral' },
    period: fill(t('v2d.vs'), { date: prior }),
  };
}

export function valueOf(
  figure: Figure,
  name: string,
  t: Translate,
): { value: string; held: boolean } {
  const measure = figureMeasure(figure.key);
  const scalar = scalarOf(figure);
  if (figure.status !== 'ready' || scalar === null)
    return { value: NO_VALUE, held: figure.status !== 'ready' };
  if (name === 'breakdown-free') {
    const counts = figure.value as { runningClean: number; inService: number };
    return {
      value: fill(t('v2d.fig.breakdown-free.value'), {
        clean: counts.runningClean,
        total: counts.inService,
      }),
      held: false,
    };
  }
  return {
    value: formatFigure(measure, scalar, ENGINE_DIGITS, figurePlaces(measure, scalar)),
    held: false,
  };
}

/** One figure as a card: its value as the engine printed it, what it covers, its change and the rows behind it. */
export function kpiOf(
  figure: Figure,
  prior: Figure | undefined,
  ctx: { sameYear: boolean; priorDay: string },
  t: Translate,
): KpiData {
  const name = figure.key.replace(/^dashboard\./, '');
  const { value, held } = valueOf(figure, name, t);
  const cover = t(COVER[name] ?? 'v2d.cover.log');
  const change = held ? undefined : changeOf(figure, prior, ctx.sameYear);
  const drill = held ? undefined : drillOf(figure, t);
  return {
    id: figure.key,
    label: label(figure.key, t),
    icon: ICON[name] ?? 'machines',
    value,
    ...changeOfCard(change, ctx.priorDay, t),
    meaning: held
      ? t('v2d.notComputed')
      : fill(t('v2d.line'), { cover, what: t(WHAT[name] ?? '') }),
    more: held ? '' : t(MORE[name] ?? 'v2d.fig.count.more'),
    ...(drill ? { drill } : {}),
  };
}
