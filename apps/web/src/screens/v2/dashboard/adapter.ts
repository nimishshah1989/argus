import type { TFunction } from 'i18next';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { Ticket } from '@uptimo/shared/replies';
import type { ScatterPoint } from '../../../ui/chart/use-chart.js';
import type { IconName } from '../../../ui/v2/icons.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { ParetoData } from '../../../ui/v2/pareto.js';
import {
  describeChange,
  figureMeasure,
  figurePlaces,
  formatFigure,
  roundMove,
  splitFigure,
} from '../../../ui/meaning/index.js';
import { fill } from '../../../i18n/fill.js';
import { bannerOf } from '../../analytics/action-center.js';
import { FIGURE_LABELS } from '../../analytics/groups.js';
import { contentOf } from '../../analytics/figure-content.js';
import { ACTION_CENTER_PATH } from '../../analytics/groups.js';
import { sentence } from '../figures/point.js';
import { dayText, sourceLine, type Translate } from '../figures/read.js';
import { engineTable } from '../figures/table.js';
import { commonWords, tableWords } from '../figures/words.js';
import { COMPARE_DAYS, changeOf, priorDate, scalarOf, type Change } from './change.js';
import { needsNowModel } from './needs-now.js';
import type { DashboardChart, DashboardModel } from './model.js';

type Figure = FiguresReply['figures'][number];

/** The figure mapper (v1's, shared) asks for i18next's own function; the catalogue is the same one. */
const asT = (t: Translate): TFunction => t as unknown as TFunction;

/** What the plant knows beside the engine's reply: the desk's open tickets, the machines, the Action Center's counts and the earlier reply. */
export type DashFacts = {
  machines: readonly { id: string; code: string; category: string | null }[];
  /** Null when the desk's tickets could not be read. */
  state: { open: readonly Ticket[]; now: string } | null;
  board: ActionCenterBoardReply | null;
  before: Pick<FiguresReply, 'figures'> | null;
};

const ICON: Record<string, IconName> = {
  'dashboard.total-machines': 'machines',
  'dashboard.utilities': 'machines',
  'dashboard.dg-sets': 'machines',
  'dashboard.cnc-machines': 'machines',
  'dashboard.conventional-machines': 'machines',
  'dashboard.process-machines': 'machines',
  'dashboard.total-breakdowns': 'alert',
  'dashboard.total-downtime-hours': 'clock',
  'dashboard.pm-hours': 'wrench',
  'dashboard.no-downtime-hours': 'pause',
  'dashboard.breakdown-free': 'check',
  'dashboard.fleet-availability': 'gauge',
  'dashboard.plant-events': 'alert',
  'dashboard.plant-bd-pct': 'gauge',
  'dashboard.avg-complaints-per-day': 'list',
  'dashboard.avg-bd-hours-per-day': 'clock',
  'dashboard.avg-bd-hours-per-machine': 'machines',
};

/** The figures that are a picture, a sentence or a short list; every other one is a number. */
const isNumber = (figure: Figure): boolean =>
  figure.status !== 'ready' || figure.value === null || typeof figure.value === 'number';

const label = (key: string, t: Translate): string =>
  t(FIGURE_LABELS[key] ?? ('analytics.figure.unknown' satisfies MessageKey));

const drillOf = (figure: Figure, t: Translate) =>
  figure.drill.ids.length > 0
    ? {
        figure: figure.key,
        label: t('analytics.today.rowsFor', { figure: label(figure.key, t) }),
      }
    : undefined;

/** The change against 30 days earlier, as a card prints it: a verdict for a rate, a quiet amount for a running total. */
function deltaOf(change: Change | undefined, t: Translate): KpiData['delta'] {
  if (change === undefined) return { text: '', up: false, good: true, flat: true };
  const move = roundMove(change.delta);
  if (change.added) {
    const sign = move > 0 ? '+' : '';
    const amount = `${sign}${formatFigure(change.measure, move, 2, figurePlaces(change.measure, move))}`;
    return {
      text: t('analytics.today.added', { amount, days: COMPARE_DAYS }),
      up: move > 0,
      good: true,
      flat: true,
    };
  }
  const { tone, text, word } = describeChange(change.measure, move);
  const shown =
    change.measure.unit === 'percent'
      ? `${move > 0 ? '+' : move < 0 ? '-' : ''}${formatFigure({ ...change.measure, unit: 'count' }, Math.abs(move))} ${t('analytics.unit.points')}`
      : text;
  return {
    text: `${shown} ${word}`,
    up: move > 0,
    good: tone === 'good',
    flat: tone === 'neutral',
  };
}

/** One number figure as a card: the engine's exact value with its unit, or a dash that says it is not computed. */
function numberCard(
  figure: Figure,
  change: Change | undefined,
  period: string,
  t: Translate,
): KpiData {
  const measure = figureMeasure(figure.key);
  const value = figure.status === 'ready' ? scalarOf(figure) : null;
  const places = value === null ? 0 : figurePlaces(measure, value);
  const { text, unit } =
    value === null ? { text: '—', unit: '' } : splitFigure(measure, value, places, places);
  return {
    id: figure.key,
    label: label(figure.key, t),
    icon: ICON[figure.key] ?? 'list',
    value: unit ? `${text} ${unit}` : text,
    delta: deltaOf(change, t),
    period,
    meaning: value === null ? t('analytics.notComputed') : '',
    more: '',
    drill: value === null ? undefined : drillOf(figure, t),
  };
}

/** The breakdown-free sentence as a card: "53 of 125 machines", and its change in clean machines. */
function cleanCard(
  figure: Figure,
  change: Change | undefined,
  period: string,
  t: Translate,
): KpiData {
  const content = contentOf(figure, asT(t));
  const text = content?.kind === 'text' ? content.text : null;
  return {
    id: figure.key,
    label: label(figure.key, t),
    icon: ICON[figure.key] ?? 'check',
    value: text ?? '—',
    delta: deltaOf(change, t),
    period,
    meaning: text === null ? t('analytics.notComputed') : '',
    more: '',
    drill: text === null ? undefined : drillOf(figure, t),
  };
}

type ProblemRow = { problem: string; hours: number; share: number | null; breakdowns: number };

/** The engine's costliest problems; a missing share stays missing, never 0. */
export function problemRows(figure: Figure): ProblemRow[] {
  const value = figure.value as { rows?: unknown } | null;
  const rows = Array.isArray(value?.rows) ? (value.rows as unknown[]) : [];
  return rows.flatMap((raw) => {
    const row = raw as Record<string, unknown>;
    const hours = Number(row.hours);
    if (!Number.isFinite(hours)) return [];
    return [
      {
        problem: String(row.problem ?? ''),
        hours,
        share: typeof row.share === 'number' && Number.isFinite(row.share) ? row.share : null,
        breakdowns: Number(row.breakdowns),
      },
    ];
  });
}

const DASH = '—';

/** The three costliest problems and everything else, as bars that add up to the engine's total, and the table of the rows. */
function costliestOf(
  figure: Figure,
  change: Change | undefined,
  t: Translate,
): DashboardModel['costliest'] {
  const rows = problemRows(figure);
  const total = scalarOf(figure);
  if (rows.length === 0 || total === null) return null;
  const measure = figureMeasure('dashboard.costliest-problems');
  const hours = (n: number) => formatFigure(measure, n);
  const common = commonWords(t);
  const drill = drillOf(figure, t);
  const rest = total - rows.reduce((sum, row) => sum + row.hours, 0);
  const bars: ParetoData['bars'] = [
    ...rows.map((row) => ({
      label: row.problem,
      hours: row.hours,
      shown: hours(row.hours),
      drill,
    })),
    ...(rest > 0.05 ? [{ label: t('v2t.dash.others'), hours: rest, shown: hours(rest) }] : []),
  ];
  const moved = deltaOf(change, t).text;
  const title = label(figure.key, t);
  const caption = t('analytics.content.costliest.caption', {
    hours: formatFigure({ ...measure, unit: 'count' }, total),
  });
  return {
    title,
    pareto: {
      bars,
      top: rows.length,
      total,
      aria: `${title}. ${caption}`,
      conclusion: [{ text: moved ? `${caption} · ${moved}` : caption, tone: 'strong' }],
      why: [[{ text: t('v2t.dash.costliestWhy') }]],
    },
    table: engineTable(
      {
        title,
        header: [
          t('analytics.content.costliest.problem'),
          t('analytics.content.costliest.hours'),
          t('analytics.content.costliest.share'),
          t('analytics.content.costliest.breakdowns'),
        ],
        rows: rows.map((row) => [
          row.problem,
          hours(row.hours),
          row.share === null ? DASH : `${row.share.toFixed(2)}%`,
          String(row.breakdowns),
        ]),
      },
      { id: 'costliest', title, words: tableWords(common, title, rows.length) },
    ),
  };
}

/** A bubble is labelled with its machine id on the server; the plant reads the code. */
function codeLabels(
  figure: Figure,
  t: Translate,
  codeOf: (id: string) => string,
): ReturnType<typeof contentOf> {
  const content = contentOf(figure, asT(t));
  if (content?.kind !== 'chart' || content.spec.kind !== 'scatter') return content;
  const points: ScatterPoint[] = content.spec.points.map((point) => ({
    ...point,
    label: codeOf(point.label),
  }));
  return { kind: 'chart', spec: { ...content.spec, points } };
}

function chartOf(
  figure: Figure,
  t: Translate,
  codeOf: (id: string) => string,
): DashboardChart | null {
  const content = codeLabels(figure, t, codeOf);
  if (content?.kind !== 'chart') return null;
  const bubble = figure.key === 'dashboard.bubble-chart';
  return {
    id: figure.key,
    spec: content.spec,
    sub: t(bubble ? 'v2t.dash.bubbleSub' : 'v2t.dash.timelineSub'),
    aria: t(bubble ? 'v2t.dash.bubbleAria' : 'v2t.dash.timelineAria'),
    drill: drillOf(figure, t),
  };
}

/** The answer first, in the engine's own words and figures: availability, the cost of the breakdowns, the costliest problem. */
function verdictOf(
  figures: Figure[],
  asOf: string,
  context: string,
  t: Translate,
): DashboardModel['verdict'] {
  const byKey = (key: string) => figures.find((figure) => figure.key === key);
  const printed = (key: string): string | null => {
    const figure = byKey(key);
    const value = figure === undefined ? null : scalarOf(figure);
    if (value === null) return null;
    const measure = figureMeasure(key);
    const places = figurePlaces(measure, value);
    return formatFigure(measure, value, places, places);
  };
  const availability = printed('dashboard.fleet-availability');
  const breakdowns = printed('dashboard.total-breakdowns');
  const hours = printed('dashboard.total-downtime-hours');
  const costliest = byKey('dashboard.costliest-problems');
  const top = costliest === undefined ? undefined : problemRows(costliest)[0];
  const whole = availability && breakdowns && hours && top;
  return {
    headline: whole
      ? sentence(t('v2t.dash.headline'), { availability, breakdowns, hours, problem: top.problem })
      : [{ text: fill(t('v2t.dash.headlineFew'), { date: dayText(asOf) }) }],
    why: [[{ text: t('v2t.dash.why1') }], [{ text: t('v2t.dash.why2') }]],
    context,
  };
}

/** The line under the verdict: the day the records run to, the machines left out, and the day the changes are against. */
function contextOf(reply: FiguresReply, compared: boolean, t: Translate): string {
  return [
    t('analytics.asOf', { date: dayText(reply.asOf) }),
    reply.excludedMachines > 0
      ? t('analytics.excludedMachines', { count: reply.excludedMachines })
      : null,
    compared
      ? t('analytics.today.vs', { date: dayText(priorDate(reply.asOf)), days: COMPARE_DAYS })
      : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/**
 * The Dashboard from the engine's reply and what the plant holds beside it. Every `dashboard.*` figure the engine sent
 * is on the page in its own period: a number is a card, the clean machines a card, the costliest problems a chart and a
 * table, the bubble and the timeline pictures. A figure the engine has not computed says so and claims no value. Null
 * when the reply holds no Dashboard figure at all.
 */
export function dashboardModel(
  reply: FiguresReply,
  facts: DashFacts,
  t: Translate,
): DashboardModel | null {
  const figures = reply.figures.filter((figure) => figure.screen === 'dashboard');
  if (figures.length === 0) return null;
  const compared = facts.before !== null;
  const sameYear = priorDate(reply.asOf).slice(0, 4) === reply.asOf.slice(0, 4);
  const changeFor = (figure: Figure) =>
    changeOf(
      figure,
      facts.before?.figures.find((other) => other.key === figure.key),
      sameYear,
    );
  const period = compared ? t('v2t.dash.vs', { date: dayText(priorDate(reply.asOf)) }) : '';
  const codeOf = (id: string) => facts.machines.find((machine) => machine.id === id)?.code ?? id;
  const banner = facts.board === null ? null : bannerOf(facts.board);
  const costliest = figures.find((figure) => figure.key === 'dashboard.costliest-problems');
  const free = figures.find((figure) => figure.key === 'dashboard.breakdown-free');
  return {
    verdict: verdictOf(figures, reply.asOf, contextOf(reply, compared, t), t),
    banner:
      banner === null
        ? null
        : {
            text: t('analytics.actionCenter.banner', { high: banner.high, medium: banner.medium }),
            href: ACTION_CENTER_PATH,
          },
    needs: facts.state === null ? null : needsNowModel(facts.state, facts.machines, t),
    kpis: [
      ...figures.filter(isNumber).map((figure) => numberCard(figure, changeFor(figure), period, t)),
      ...(free === undefined ? [] : [cleanCard(free, changeFor(free), period, t)]),
    ],
    costliest: costliest === undefined ? null : costliestOf(costliest, changeFor(costliest), t),
    charts: figures.flatMap((figure) => {
      const chart = ['dashboard.bubble-chart', 'dashboard.expansion-timeline'].includes(figure.key)
        ? chartOf(figure, t, codeOf)
        : null;
      return chart === null ? [] : [chart];
    }),
    source: sourceLine(commonWords(t).source, reply.asOf),
    words: {
      why: commonWords(t).why,
      whyThese: t('v2t.dash.share'),
      openActionCenter: t('analytics.actionCenter.banner.open'),
    },
  };
}
