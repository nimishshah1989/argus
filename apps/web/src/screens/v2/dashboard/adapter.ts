import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import { bannerOf } from '../../analytics/action-center.js';
import { contentOf } from '../../analytics/figure-content.js';
import { ACTION_CENTER_PATH } from '../../analytics/groups.js';
import { COMPARE_DAYS, priorDate } from '../../analytics/today-change.js';
import { sentence } from '../figures/point.js';
import { dayText, sourceLine, type Translate } from '../figures/read.js';
import { GROUPS, NO_VALUE, changeOfCard, dash, drillOf, kpiOf, label, valueOf } from './cards.js';
import { changeOf } from '../../analytics/today-change.js';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { ChartModel, DashboardFacts, DashboardModel, PlantMachine } from './model.js';
import { bubblePoints, costliestOf, machinesTable, needsOf, warningOf } from './tables.js';
import { needsNow } from './needs.js';

type Figure = FiguresReply['figures'][number];

function verdictOf(
  figure: Figure | undefined,
  open: DashboardFacts['open'],
  ctx: { reply: FiguresReply; prior: FiguresReply | undefined; priorDay: string },
  t: Translate,
) {
  const items = open === null ? null : needsNow(open.tickets, open.now).length;
  const first =
    items === null
      ? t('v2d.headline.unknown')
      : items === 0
        ? t('v2d.headline.none')
        : fill(t('v2d.headline.some'), { n: items });
  const available = figure === undefined ? null : valueOf(figure, 'fleet-availability', t);
  const fleet =
    available === null || available.value === NO_VALUE
      ? []
      : [{ text: ' ' }, ...sentence(t('v2d.headline.fleet'), { availability: available.value })];
  const excluded = ctx.reply.excludedMachines;
  const parts = [
    t('analytics.asOf', { date: dayText(ctx.reply.asOf) }),
    excluded > 0
      ? fill(t(excluded === 1 ? 'v2d.excluded.one' : 'v2d.excluded.many'), { n: excluded })
      : null,
    ctx.prior ? t('analytics.today.vs', { date: ctx.priorDay, days: COMPARE_DAYS }) : null,
  ].filter((part) => part !== null);
  return {
    headline: [{ text: first, ...(items ? { tone: 'risk' as const } : {}) }, ...fleet],
    context: parts.join(' · '),
    why: [[{ text: t('v2d.why.cover') }], [{ text: t('v2d.why.needs') }]],
  };
}

/** The 30-day change of the costliest problems' total hours, as v1 showed it under the table. */
function costliestChange(
  figure: Figure,
  before: Figure | undefined,
  ctx: { sameYear: boolean; priorDay: string },
  t: Translate,
) {
  const change = figure.status === 'ready' ? changeOf(figure, before, ctx.sameYear) : undefined;
  return changeOfCard(change, ctx.priorDay, t);
}

/** The Action Center's open high and medium counts with the way in; none when no nudge is open. */
export function actionCenterOf(
  board: DashboardFacts['board'],
  t: Translate,
): DashboardModel['actionCenter'] {
  const banner = board === null ? null : bannerOf(board);
  return banner
    ? {
        title: t('v2d.ac.title'),
        text: t('analytics.actionCenter.banner', { high: banner.high, medium: banner.medium }),
        open: t('analytics.actionCenter.banner.open'),
        href: ACTION_CENTER_PATH,
      }
    : null;
}

/** A point of the bubble chart is labelled by the machine's code; one the plant no longer lists is a dash, never its id. */
function relabelled(spec: ChartSpec, plant: readonly PlantMachine[]): ChartSpec {
  if (spec.kind !== 'scatter') return spec;
  const codeOf = new Map(plant.map((m) => [m.id, m.code]));
  return {
    ...spec,
    points: spec.points.map((p) => ({ ...p, label: codeOf.get(p.label) ?? NO_VALUE })),
  };
}

/**
 * The bubble chart and the expansion timeline as v1 drew them, each with its rows behind it. A figure the engine has not
 * computed, or computed as nothing (a plant with no history), keeps its card and says so, as v1's tile did.
 */
function chartsOf(reply: FiguresReply, plant: readonly PlantMachine[], t: Translate): ChartModel[] {
  const pictures = [
    ['bubble-chart', 'v2d.bubble.sub', 'v2d.bubble.aria'],
    ['expansion-timeline', 'v2d.timeline.sub', 'v2d.timeline.aria'],
  ] as const;
  return pictures.flatMap(([name, sub, aria]): ChartModel[] => {
    const figure = reply.figures.find((f) => f.key === dash(name));
    if (!figure) return [];
    const title = label(figure.key, t);
    const content = figure.status === 'ready' ? contentOf(figure, t as unknown as TFunction) : null;
    if (content?.kind !== 'chart')
      return [
        {
          id: figure.key,
          title,
          note: figure.status === 'ready' ? NO_VALUE : t('v2d.notComputed'),
        },
      ];
    const drill = drillOf(figure, t);
    return [
      {
        id: figure.key,
        title,
        spec: relabelled(content.spec, plant),
        sub: t(sub),
        aria: t(aria),
        ...(drill ? { drill } : {}),
      },
    ];
  });
}

/**
 * The Dashboard from the engine's reply (the same 20 figures v1 printed, each over the span v1 used and each with its
 * rows behind it), the desk's open tickets (what needs a person now) and the Action Center's counts. Pure: the reply
 * and the words go in, the model comes out. Nothing here recomputes a figure; it formats, orders and words.
 */
export function dashboardModel(facts: DashboardFacts, translate: Translate): DashboardModel {
  const t = translate;
  const { reply, prior, open, board, machines } = facts;
  const figureOf = (key: string) => reply.figures.find((f) => f.key === key);
  const earlier = (key: string) => prior?.figures.find((f) => f.key === key);
  const priorDay = priorDate(reply.asOf);
  const ctx = {
    sameYear: priorDay.slice(0, 4) === reply.asOf.slice(0, 4),
    priorDay: dayText(priorDay),
  };
  const needs = needsOf(open, machines, t);
  const sections = GROUPS.map((group) => ({
    id: group.id,
    title: t(group.title),
    sub: t(group.sub),
    kpis: group.keys.flatMap((name) => {
      const figure = figureOf(dash(name));
      return figure ? [kpiOf(figure, earlier(dash(name)), ctx, t)] : [];
    }),
  }));
  const costliest = figureOf(dash('costliest-problems'));
  return {
    verdict: verdictOf(
      figureOf(dash('fleet-availability')),
      open,
      { reply, prior, priorDay: ctx.priorDay },
      t,
    ),
    needs,
    actionCenter: actionCenterOf(board, t),
    sections: sections.filter((s) => s.kpis.length > 0),
    costliest: costliest
      ? costliestOf(
          costliest,
          costliestChange(costliest, earlier(dash('costliest-problems')), ctx, t),
          t,
        )
      : null,
    warning: warningOf(reply, machines, t),
    charts: chartsOf(reply, machines, t),
    machines: machinesTable(bubblePoints(figureOf(dash('bubble-chart'))), machines, t),
    source: sourceLine(t('v2m.source'), reply.asOf),
    words: { why: t('v2m.why') },
  };
}
