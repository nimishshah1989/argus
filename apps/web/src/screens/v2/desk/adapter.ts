import type { TFunction } from 'i18next';
import { taskState } from '@uptimo/shared/tasks';
import type { Ticket } from '../../../api.js';
import { actorFrom, quickSpec } from '../../../components/actionSpecs.js';
import {
  formatDateTime,
  formatMinutes,
  machineLabel,
  peopleNames,
} from '../../../components/format.js';
import type { TakeawayData } from '../../../ui/v2/takeaway.js';
import {
  breakdownCount,
  downNow,
  notStarted,
  openCounts,
  pausedBreakdowns,
  pendingTasks,
  workRequests,
} from '../../desk/openLists.js';
import { tagOf } from '../insight.js';
import { plantToday } from './model.js';
import type {
  CountTile,
  OpenCard,
  OpenInput,
  OpenModel,
  ReportCard,
  Segment,
  TaskCard,
} from './model.js';

const DAY_MS = 86_400_000;

/** `2026-11-27` as "27 Nov", read as a calendar date so no time zone moves it. */
const dayLabel = (on: string): string =>
  new Date(`${on}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

type Ctx = {
  t: TFunction;
  names: Record<string, string>;
  reasons: Record<string, string>;
  machineOf: (ticket: Ticket) => string;
};

const TILES: [CountTile['id'], CountTile['tone']][] = [
  ['down', 'danger'],
  ['waiting', 'hold'],
  ['support', 'warning'],
  ['running', 'ok'],
];

/** Distinct leads of working or paused tickets (v1 `Board.tsx` `teamNowCount`), said as the Team now link. */
function teamNowText(open: Ticket[], t: TFunction): string {
  const leads = new Set(
    open
      .filter((x) => (x.status === 'working' || x.status === 'waiting') && x.leadPersonId)
      .map((x) => x.leadPersonId),
  ).size;
  return t(`deskLists.teamNow.${leads === 0 ? 'none' : leads === 1 ? 'one' : 'many'}`, {
    count: leads,
  });
}

/** Breakdowns verdict: the longest-down stopped machine against the average of the not-started stopped ones. */
function breakdownsLine(stopped: OpenCard[], now: string, t: TFunction): TakeawayData | null {
  const downOf = (c: OpenCard) => downNow(c.ticket, now);
  const top = stopped.reduce<OpenCard | undefined>(
    (a, b) => (a && downOf(a) >= downOf(b) ? a : b),
    undefined,
  );
  if (!top) return null;
  top.longest = true;
  const avg = stopped.reduce((sum, c) => sum + downOf(c), 0) / stopped.length;
  const key =
    stopped.length > 1 && avg > 0
      ? 'deskLists.takeaway.breakdowns'
      : 'deskLists.takeaway.breakdownsOne';
  return {
    text: t(key, {
      machine: top.machine,
      time: formatMinutes(downOf(top)),
      n: Math.round(downOf(top) / avg),
      avg: formatMinutes(avg),
    }),
    tone: 'loss',
    tag: tagOf('loss', (k) => t(k)),
    outlier: top.ticket.ref,
  };
}

function taskCards(
  pending: Ticket[],
  today: string,
  { t, names, reasons, machineOf }: Ctx,
): TaskCard[] {
  return pending.map((ticket) => {
    const state = taskState(ticket, today);
    const reason = ticket.taskReason ? (reasons[ticket.taskReason] ?? ticket.taskReason) : '';
    const expected = ticket.taskExpectedOn
      ? t('tasks.expected', { date: ticket.taskExpectedOn })
      : '';
    const who = ticket.reportedByPersonId ? names[ticket.reportedByPersonId] : undefined;
    return {
      ticket,
      machine: machineOf(ticket),
      state,
      overdue: state === 'overdue',
      line: [reason, expected].filter(Boolean).join(' · '),
      meta: who ? t('tasks.leftBy', { who }) : t('tasks.thisTask'),
    };
  });
}

/** Tasks verdict: the earliest expected task, its date, days from the plant's today. */
function tasksLine(cards: TaskCard[], today: string, t: TFunction): TakeawayData | null {
  const first = cards.find((c) => c.ticket.taskExpectedOn);
  const on = first?.ticket.taskExpectedOn;
  if (!first || !on) return null;
  const days = Math.round((Date.parse(on) - Date.parse(today)) / DAY_MS);
  const tone = days < 0 ? 'risk' : 'neutral';
  return {
    text: t(days < 0 ? 'deskLists.takeaway.tasksLate' : 'deskLists.takeaway.tasks', {
      machine: first.machine,
      date: dayLabel(on),
      days: Math.abs(days),
    }),
    tone,
    tag: tagOf(tone, (k) => t(k)),
    outlier: first.ticket.ref,
  };
}

function reportCards(tickets: Ticket[], { t, names, machineOf }: Ctx): ReportCard[] {
  return tickets.map((ticket) => {
    const at = ticket.closedAt ? formatDateTime(ticket.closedAt) : '';
    const who = ticket.closedByPersonId ? names[ticket.closedByPersonId] : undefined;
    return {
      ticket,
      machine: machineOf(ticket),
      meta: who ? t('deskLists.closedBy', { at, who }) : t('deskLists.closed', { at }),
    };
  });
}

function segmentsOf(counts: Record<Segment, number>, segment: Segment, t: TFunction) {
  return (['breakdowns', 'tasks', 'work'] as const).map((id) => ({
    id,
    label: t(`deskLists.tab.${id}`, { count: counts[id] }),
    pressed: id === segment,
  }));
}

function countTiles(counts: Record<CountTile['id'], number>, filter: string, t: TFunction) {
  return TILES.map(([id, tone]) => ({
    id,
    label: t(`deskLists.chip.${id}`),
    value: counts[id],
    tone,
    pressed: filter === id,
  }));
}

function needsReportBlock(reports: ReportCard[], t: TFunction): OpenModel['needsReport'] {
  if (!reports.length) return null;
  return {
    heading: t('deskLists.needsReport', { count: reports.length }),
    hint: t('deskLists.needsReport.hint'),
    cards: reports,
  };
}

function wordsOf(t: TFunction): OpenModel['words'] {
  return {
    longest: t('deskLists.longest'),
    pickTicket: t('deskWide.pickTicket'),
    ticketPane: t('deskWide.ticket'),
    fillReport: t('deskLists.fillReport'),
    chips: t('deskLists.chips'),
    segments: t('deskLists.segments'),
    waiting: t('deskLists.chip.waiting'),
    needsReport: t('desk.needsReport'),
  };
}

function showingText(filter: string, t: TFunction): string | null {
  if (!filter || filter === 'running') return null;
  return t('deskLists.showing', { what: t(`deskLists.filter.${filter}`) });
}

function breakdownsBlock(
  start: OpenCard[],
  paused: OpenCard[],
  t: TFunction,
): OpenModel['breakdowns'] {
  return {
    hint: t('deskLists.hint.start'),
    empty: t('deskLists.empty.start'),
    cards: start,
    paused: paused.length
      ? { heading: t('deskLists.pausedSection', { count: paused.length }), cards: paused }
      : null,
  };
}

/**
 * The Open screen from the `/state`, `/config` and `/auth/me` replies. Lists and counts come from v1's
 * `screens/desk/openLists.ts` (kept, imported); cards' quick button from `components/actionSpecs.ts` `quickSpec`;
 * task "today" from `plantToday` in the plant's time zone; the two takeaways are computed here.
 */
export function openModel(input: OpenInput, t: TFunction): OpenModel {
  const { state, config, me, filter, segment } = input;
  const open = state.open;
  const machines = config?.machines ?? [];
  const names = peopleNames(config?.people);
  const actor = me ? actorFrom(me) : null;
  const ctx: Ctx = {
    t,
    names,
    reasons: Object.fromEntries((config?.lists.task_reason ?? []).map((r) => [r.code, r.label])),
    machineOf: (ticket) => machineLabel(ticket, machines),
  };
  const card = (ticket: Ticket): OpenCard => ({
    ticket,
    machine: ctx.machineOf(ticket),
    quick: actor ? quickSpec(ticket, actor) : null,
    longest: false,
  });

  const counts = openCounts(open, machines);
  const breakdownTotal = breakdownCount(open);
  const start = notStarted(open, filter).map(card);
  const breakdownsTakeaway = breakdownsLine(
    start.filter((c) => c.ticket.kind === 'stopped'),
    state.now,
    t,
  );
  const paused = pausedBreakdowns(open, filter).map(card);
  const today = plantToday(config?.timeZone ?? 'UTC', new Date(state.now));
  const pending = pendingTasks(open);
  const tasks = taskCards(pending, today, ctx);
  const reports = reportCards(state.needReport, ctx);
  const work = workRequests(open);

  return {
    badge: breakdownTotal,
    counts: countTiles(counts, filter, t),
    showing: showingText(filter, t),
    teamNow: teamNowText(open, t),
    segment,
    segments: segmentsOf(
      { breakdowns: breakdownTotal, tasks: pending.length, work: work.length },
      segment,
      t,
    ),
    breakdowns: breakdownsBlock(start, paused, t),
    tasks: { hint: t('tasks.tabHint'), empty: t('tasks.tabEmpty'), cards: tasks },
    work: {
      hint: t('deskLists.hint.work'),
      empty: t('deskLists.empty.work'),
      cards: work.map(card),
    },
    needsReport: needsReportBlock(reports, t),
    takeaways: { 'desk.breakdowns': breakdownsTakeaway, 'desk.tasks': tasksLine(tasks, today, t) },
    words: wordsOf(t),
    now: state.now,
    names,
  };
}
