import type { TFunction } from 'i18next';
import { taskState } from '@uptimo/shared/tasks';
import type { Ticket } from '../../../api.js';
import { actorFrom, quickSpec } from '../../../components/actionSpecs.js';
import { formatDateTime, formatMinutes, machineLabel, peopleNames } from '../../../components/format.js';
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
import { plantToday, showsSettings } from './model.js';
import type { CountTile, OpenCard, OpenInput, OpenModel, ReportCard, TaskCard } from './model.js';

const DAY_MS = 86_400_000;

/** `2026-11-27` as "27 Nov", read as a calendar date so no time zone moves it. */
const dayLabel = (on: string): string =>
  new Date(`${on}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

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
  const machineOf = (ticket: Ticket) => machineLabel(ticket, machines);
  const card = (ticket: Ticket): OpenCard => ({
    ticket,
    machine: machineOf(ticket),
    quick: actor ? quickSpec(ticket, actor) : null,
    longest: false,
  });

  const counts = openCounts(open, machines);
  const tiles: [CountTile['id'], CountTile['tone']][] = [
    ['down', 'danger'],
    ['waiting', 'hold'],
    ['support', 'warning'],
    ['running', 'ok'],
  ];
  const leads = new Set(
    open
      .filter((x) => (x.status === 'working' || x.status === 'waiting') && x.leadPersonId)
      .map((x) => x.leadPersonId),
  ).size;
  const teamKey = leads === 0 ? 'none' : leads === 1 ? 'one' : 'many';
  const breakdownTotal = breakdownCount(open);

  const start = notStarted(open, filter).map(card);
  const stopped = start.filter((c) => c.ticket.kind === 'stopped');
  const downOf = (c: OpenCard) => downNow(c.ticket, state.now);
  const top = stopped.reduce<OpenCard | undefined>((a, b) => (a && downOf(a) >= downOf(b) ? a : b), undefined);
  if (top) top.longest = true;
  const paused = pausedBreakdowns(open, filter).map(card);

  const today = plantToday(config?.timeZone ?? 'UTC', new Date(state.now));
  const reasons = Object.fromEntries((config?.lists.task_reason ?? []).map((r) => [r.code, r.label]));
  const pending = pendingTasks(open);
  const taskCards: TaskCard[] = pending.map((ticket) => {
    const s = taskState(ticket, today);
    const reason = ticket.taskReason ? (reasons[ticket.taskReason] ?? ticket.taskReason) : '';
    const expected = ticket.taskExpectedOn ? t('tasks.expected', { date: ticket.taskExpectedOn }) : '';
    const who = ticket.reportedByPersonId ? names[ticket.reportedByPersonId] : undefined;
    return {
      ticket,
      machine: machineOf(ticket),
      state: s,
      overdue: s === 'overdue',
      line: [reason, expected].filter(Boolean).join(' · '),
      meta: who ? t('tasks.leftBy', { who }) : t('tasks.thisTask'),
    };
  });

  const avg = stopped.reduce((sum, c) => sum + downOf(c), 0) / (stopped.length || 1);
  const breakdownsLine: TakeawayData | null = top
    ? {
        text: t(
          stopped.length > 1 && avg > 0
            ? 'deskLists.takeaway.breakdowns'
            : 'deskLists.takeaway.breakdownsOne',
          {
            machine: top.machine,
            time: formatMinutes(downOf(top)),
            n: Math.round(downOf(top) / avg),
            avg: formatMinutes(avg),
          },
        ),
        tone: 'loss',
        tag: tagOf('loss', (k) => t(k)),
        outlier: top.ticket.ref,
      }
    : null;

  const first = taskCards.find((c) => c.ticket.taskExpectedOn);
  const days = first
    ? Math.round((Date.parse(first.ticket.taskExpectedOn!) - Date.parse(today)) / DAY_MS)
    : 0;
  const tone = days < 0 ? 'risk' : 'neutral';
  const tasksLine: TakeawayData | null = first
    ? {
        text: t(days < 0 ? 'deskLists.takeaway.tasksLate' : 'deskLists.takeaway.tasks', {
          machine: first.machine,
          date: dayLabel(first.ticket.taskExpectedOn!),
          days: Math.abs(days),
        }),
        tone,
        tag: tagOf(tone, (k) => t(k)),
        outlier: first.ticket.ref,
      }
    : null;

  const reports: ReportCard[] = state.needReport.map((ticket) => {
    const at = ticket.closedAt ? formatDateTime(ticket.closedAt) : '';
    const who = ticket.closedByPersonId ? names[ticket.closedByPersonId] : undefined;
    return {
      ticket,
      machine: machineOf(ticket),
      meta: who ? t('deskLists.closedBy', { at, who }) : t('deskLists.closed', { at }),
    };
  });
  const work = workRequests(open);

  return {
    badge: breakdownTotal,
    settings: showsSettings(me?.role),
    counts: tiles.map(([id, tn]) => ({
      id,
      label: t(`deskLists.chip.${id}`),
      value: counts[id],
      tone: tn,
      pressed: filter === id,
    })),
    showing:
      filter && filter !== 'running'
        ? t('deskLists.showing', { what: t(`deskLists.filter.${filter}`) })
        : null,
    teamNow: t(`deskLists.teamNow.${teamKey}`, { count: leads }),
    segment,
    segments: [
      { id: 'breakdowns', label: t('deskLists.tab.breakdowns', { count: breakdownTotal }) },
      { id: 'tasks', label: t('deskLists.tab.tasks', { count: pending.length }) },
      { id: 'work', label: t('deskLists.tab.work', { count: work.length }) },
    ].map((s) => ({ ...s, id: s.id as OpenModel['segment'], pressed: s.id === segment })),
    breakdowns: {
      hint: t('deskLists.hint.start'),
      empty: t('deskLists.empty.start'),
      cards: start,
      paused: paused.length
        ? { heading: t('deskLists.pausedSection', { count: paused.length }), cards: paused }
        : null,
    },
    tasks: { hint: t('tasks.tabHint'), empty: t('tasks.tabEmpty'), cards: taskCards },
    work: {
      hint: t('deskLists.hint.work'),
      empty: t('deskLists.empty.work'),
      cards: work.map(card),
    },
    needsReport: reports.length
      ? {
          heading: t('deskLists.needsReport', { count: reports.length }),
          hint: t('deskLists.needsReport.hint'),
          cards: reports,
        }
      : null,
    takeaways: { 'desk.breakdowns': breakdownsLine, 'desk.tasks': tasksLine },
    words: {
      longest: t('deskLists.longest'),
      pickTicket: t('deskWide.pickTicket'),
      ticketPane: t('deskWide.ticket'),
      fillReport: t('deskLists.fillReport'),
      chips: t('deskLists.chips'),
      segments: t('deskLists.segments'),
      waiting: t('deskLists.chip.waiting'),
      needsReport: t('desk.needsReport'),
    },
    now: state.now,
    names,
  };
}
