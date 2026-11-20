import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import { bannerOf } from '../../analytics/action-center.js';
import { contentOf } from '../../analytics/figure-content.js';
import { ACTION_CENTER_PATH } from '../../analytics/groups.js';
import { COMPARE_DAYS, priorDate } from '../../analytics/today-change.js';
import { sentence } from '../figures/point.js';
import { dayText, sourceLine, type Translate } from '../figures/read.js';
import { GROUPS, NO_VALUE, dash, drillOf, kpiOf, valueOf } from './cards.js';
import type { DashboardFacts, DashboardModel } from './model.js';
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

/** The bubble chart and the expansion timeline as the engine drew them in v1, each with its rows behind it. */
function chartsOf(reply: FiguresReply, t: Translate): DashboardModel['charts'] {
  const pictures = [
    ['bubble-chart', 'v2d.bubble.sub', 'v2d.bubble.aria'],
    ['expansion-timeline', 'v2d.timeline.sub', 'v2d.timeline.aria'],
  ] as const;
  return pictures.flatMap(([name, sub, aria]) => {
    const figure = reply.figures.find((f) => f.key === dash(name));
    const content = figure ? contentOf(figure, t as unknown as TFunction) : null;
    if (!figure || content?.kind !== 'chart') return [];
    const drill = drillOf(figure, t);
    return [
      {
        id: figure.key,
        spec: content.spec,
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
  const banner = board === null ? null : bannerOf(board);
  return {
    verdict: verdictOf(
      figureOf(dash('fleet-availability')),
      open,
      { reply, prior, priorDay: ctx.priorDay },
      t,
    ),
    needs,
    actionCenter: banner
      ? {
          title: t('v2d.ac.title'),
          text: t('analytics.actionCenter.banner', { high: banner.high, medium: banner.medium }),
          open: t('analytics.actionCenter.banner.open'),
          href: ACTION_CENTER_PATH,
        }
      : null,
    sections: sections.filter((s) => s.kpis.length > 0),
    costliest: costliest ? costliestOf(costliest, t) : null,
    warning: warningOf(reply, machines, t),
    charts: chartsOf(reply, t),
    machines: machinesTable(bubblePoints(figureOf(dash('bubble-chart'))), machines, t),
    source: sourceLine(t('v2m.source'), reply.asOf),
    words: { why: t('v2m.why') },
  };
}
