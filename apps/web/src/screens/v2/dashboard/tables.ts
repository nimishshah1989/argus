import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Ticket } from '../../../api.js';
import { formatMinutes, formatTime } from '../../../components/format.js';
import { fill } from '../../../i18n/fill.js';
import type { Cell, TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import { reliabilityOf } from '../../analytics/reliability-values.js';
import { typeLine, timeLine } from '../../desk/openLists.js';
import { dayText, machineChip, numberIn, type Translate } from '../figures/read.js';
import { commonWords, tableWords } from '../figures/words.js';
import { NO_VALUE, drillOf } from './cards.js';
import type {
  CostliestModel,
  DashboardFacts,
  NeedsModel,
  PlantMachine,
  WarningModel,
} from './model.js';
import { breachOf, clocksBreached, needsNow } from './needs.js';

type Figure = FiguresReply['figures'][number];

const oneDecimal = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const twoDecimals = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** What the card for the costliest problems says when it has no rows: held, nothing recorded, or nothing to rank. */
function costliestEmpty(figure: Figure, t: Translate): string {
  if (figure.status !== 'ready') return t('v2d.notComputed');
  return figure.value === null ? NO_VALUE : t('v2d.costliest.empty');
}

/** The problems that cost the most downtime; `change` is what their hours gained in 30 days (a running total: no verdict). */
export function costliestOf(
  figure: Figure,
  change: Pick<KpiData, 'delta' | 'period'>,
  t: Translate,
): CostliestModel {
  const value = (figure.value ?? {}) as { rows?: unknown; totalHours?: unknown };
  const rows = Array.isArray(value.rows) ? value.rows : [];
  const cells = rows.flatMap((raw): Cell[][] => {
    const row = raw as {
      problem?: unknown;
      hours?: unknown;
      share?: unknown;
      breakdowns?: unknown;
    };
    const hours = Number(row.hours);
    if (!Number.isFinite(hours)) return [];
    const share = typeof row.share === 'number' && Number.isFinite(row.share) ? row.share : null;
    const problem = String(row.problem ?? '');
    return [
      [
        { text: problem, sort: problem },
        { text: oneDecimal.format(hours), sort: hours },
        { text: share === null ? NO_VALUE : `${twoDecimals.format(share)}%`, sort: share ?? -1 },
        { text: whole.format(Number(row.breakdowns)), sort: Number(row.breakdowns) },
      ],
    ];
  });
  const total = Number(value.totalHours);
  const title = t('v2d.costliest.title');
  const header = [
    { label: t('analytics.content.costliest.problem'), numeric: false },
    { label: t('analytics.content.costliest.hours'), numeric: true },
    { label: t('analytics.content.costliest.share'), numeric: true },
    { label: t('analytics.content.costliest.breakdowns'), numeric: true },
  ];
  const drill = figure.status === 'ready' ? drillOf(figure, t) : undefined;
  const added = change.delta.text === '' ? null : `${change.delta.text} ${change.period}`;
  const sub = [
    Number.isFinite(total)
      ? t('analytics.content.costliest.caption', { hours: oneDecimal.format(total) })
      : null,
    added,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return {
    title,
    sub,
    empty: costliestEmpty(figure, t),
    table:
      cells.length === 0
        ? null
        : {
            id: 'costliest',
            title,
            header,
            rows: cells,
            chips: [],
            words: { ...tableWords(commonWords(t), title, cells.length), sub },
          },
    ...(drill ? { drill } : {}),
  };
}

export type BubblePoint = {
  id: string;
  x: number;
  y: number;
  model: string | null;
  age: string | null;
  mttr: number | null;
};

/** The machines of the engine's bubble chart, with every field the chart's tooltip holds. */
export function bubblePoints(figure: Figure | undefined): BubblePoint[] {
  const value = figure?.status === 'ready' ? (figure.value as { datasets?: unknown }) : null;
  const sets = Array.isArray(value?.datasets) ? (value.datasets as { data?: unknown }[]) : [];
  return sets.flatMap((set) =>
    (Array.isArray(set.data) ? set.data : []).flatMap((raw): BubblePoint[] => {
      const p = raw as Record<string, unknown>;
      const [x, y] = [Number(p.x), Number(p.y)];
      if (typeof p.id !== 'string' || !Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [
        {
          id: p.id,
          x,
          y,
          model: typeof p.model === 'string' ? p.model : null,
          age: typeof p.age === 'string' ? p.age : null,
          mttr: typeof p.mttr === 'number' && Number.isFinite(p.mttr) ? p.mttr : null,
        },
      ];
    }),
  );
}

/** A machine of the plant's list as a chip by its code; one the plant no longer lists is a dash, never its database id. */
function machineCell(machine: PlantMachine | undefined): Cell {
  return machine
    ? {
        text: machine.code,
        sort: machine.code,
        chip: machineChip(machine.code, machine.category ?? undefined),
      }
    : { text: NO_VALUE, sort: '' };
}

export function machinesTable(
  points: BubblePoint[],
  plant: readonly PlantMachine[],
  t: Translate,
): TableModel | null {
  if (points.length === 0) return null;
  const title = t('v2d.machines.title');
  const header = [
    { label: t('v2d.machines.col.machine'), numeric: false },
    { label: t('v2d.machines.col.model'), numeric: false },
    { label: t('v2d.machines.col.age'), numeric: true },
    { label: t('v2d.machines.col.hours'), numeric: true },
    { label: t('v2d.machines.col.breakdowns'), numeric: true },
    { label: t('v2d.machines.col.mttr'), numeric: true },
  ];
  const rows = [...points]
    .sort((a, b) => b.x - a.x)
    .map((p): Cell[] => [
      machineCell(plant.find((m) => m.id === p.id)),
      { text: p.model ?? NO_VALUE, sort: p.model ?? '' },
      { text: p.age ?? NO_VALUE, sort: numberIn(p.age ?? '') ?? -1 },
      { text: twoDecimals.format(p.x), sort: p.x },
      { text: whole.format(p.y), sort: p.y },
      { text: p.mttr === null ? NO_VALUE : oneDecimal.format(p.mttr), sort: p.mttr ?? -1 },
    ]);
  return {
    id: 'machines',
    title,
    header,
    rows,
    chips: [],
    words: tableWords(commonWords(t), title, rows.length),
  };
}

const BREACH_KEY = {
  ack: 'analytics.needsNow.ackBreached',
  restore: 'analytics.needsNow.restoreBreached',
  both: 'analytics.needsNow.bothBreached',
} as const;

function needsRow(
  ticket: Ticket,
  now: string,
  plant: readonly PlantMachine[],
  t: Translate,
): Cell[] {
  const machine = plant.find((m) => m.id === ticket.machineId);
  const where = machine ? machine.code : (ticket.location ?? ticket.ref);
  const kind = typeLine(ticket);
  const line = timeLine(ticket, now);
  const breach = breachOf(ticket);
  const clock = breach ? t(BREACH_KEY[breach]) : NO_VALUE;
  return [
    machine
      ? { text: where, sort: where, chip: machineChip(machine.code, machine.category ?? undefined) }
      : { text: where, sort: where },
    {
      text: fill(t('v2d.needs.open'), { ref: ticket.ref }),
      sort: ticket.ref,
      href: `/desk/${ticket.id}`,
    },
    { text: ticket.problem ?? NO_VALUE, sort: ticket.problem ?? '' },
    { text: t(kind.key, { date: kind.date ? dayText(kind.date) : '' }), sort: kind.key },
    {
      text: t(line.key, {
        time: formatMinutes(line.minutes),
        since: line.since ? formatTime(line.since) : '',
      }),
      sort: line.minutes,
    },
    { text: clock, sort: breach ?? '' },
  ];
}

export function needsOf(
  open: DashboardFacts['open'],
  plant: readonly PlantMachine[],
  t: Translate,
): NeedsModel {
  const title = t('analytics.needsNow.title');
  if (open === null) return { state: 'unavailable', title, text: t('v2d.needs.unavailable') };
  const items = needsNow(open.tickets, open.now);
  const rows = items.map((ticket) => needsRow(ticket, open.now, plant, t));
  const header = [
    { label: t('v2d.needs.col.machine'), numeric: false },
    { label: t('v2d.needs.col.ticket'), numeric: false },
    { label: t('v2d.needs.col.problem'), numeric: false },
    { label: t('v2d.needs.col.kind'), numeric: false },
    { label: t('v2d.needs.col.time'), numeric: true },
    { label: t('v2d.needs.col.clock'), numeric: false },
  ];
  const clocks = [
    ...new Set(rows.map((row) => row[5]?.text ?? '').filter((text) => text !== NO_VALUE)),
  ];
  const counts = t('analytics.needsNow.counts', {
    items: items.length,
    clocks: clocksBreached(open.tickets),
  });
  return {
    state: 'ready',
    title,
    counts,
    empty: t('analytics.needsNow.empty'),
    table:
      rows.length === 0
        ? null
        : {
            id: 'needs',
            title,
            header,
            rows,
            chips: clocks.map((text) => ({ key: text, label: text, column: 5 })),
            words: { ...tableWords(commonWords(t), title, rows.length), sub: counts },
          },
  };
}

const MOST_SHOWN = 8;

/** The machines the engine's trend test calls worsening (a rise past two standard errors), steepest first. */
export function warningOf(
  reply: FiguresReply,
  plant: readonly PlantMachine[],
  t: Translate,
): WarningModel | null {
  const figure = reply.figures.find((f) => f.key === 'reliability');
  if (figure?.status !== 'ready') return null;
  const worse = plant
    .flatMap((m) => {
      const fit = reliabilityOf(figure.value, m.id)?.fit;
      return fit?.status === 'fitted' && fit.trend.word === 'worsening'
        ? [{ m, beta: fit.trend.beta }]
        : [];
    })
    .sort((a, b) => b.beta - a.beta);
  const shown = worse.slice(0, MOST_SHOWN);
  const lead =
    worse.length === 0
      ? t('v2d.warn.none')
      : fill(t(worse.length === 1 ? 'v2d.warn.one' : 'v2d.warn.some'), { n: worse.length });
  return {
    title: t('v2d.warn.title'),
    sub: t('v2d.warn.sub'),
    headline: [
      { text: lead, ...(worse.length > 0 ? { tone: 'risk' as const } : {}) },
      ...shown.flatMap(({ m }) => [
        { text: ' ' },
        { text: m.code, entity: machineChip(m.code, m.category ?? undefined) },
      ]),
    ],
    why: [[{ text: t('v2d.warn.why') }]],
    whyLabel: t('v2m.why'),
  };
}
