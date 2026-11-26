import type { TFunction } from 'i18next';
import type { Config, Ticket } from '../../../api.js';
import { actorFrom, quickSpec } from '../../../components/actionSpecs.js';
import {
  elapsedLabel,
  formatMinutes,
  machineLabel,
  peopleNames,
} from '../../../components/format.js';
import type { TakeawayData } from '../../../ui/v2/takeaway.js';
import {
  cancelledLast24h,
  closedLast30Days,
  dayReportHref,
  monthlyTotals,
  ticketTime,
  todayDate,
} from '../../desk/views.js';
import { tagOf } from '../insight.js';
import type {
  MineCard,
  MineInput,
  MineModel,
  MonthBlock,
  TeamInput,
  TeamModel,
  TicketRowItem,
  WindowBlock,
  WindowRead,
  WorkingRow,
} from './team-model.js';
import { waitingFirst } from './team-model.js';

/** v1 `ClosedSection.monthLabel`: `2026-11` as "November 2026", read as UTC. */
const monthLabel = (month: string): string =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

/** v1 `TeamPanel.waitText`: the plant list's label, else the raw code, else a dash. */
function waitText(ticket: Ticket, config: Config | undefined): string {
  if (!ticket.waitReason) return '—';
  const item = (config?.lists.wait_reason ?? []).find((entry) => entry.code === ticket.waitReason);
  return item?.label ?? ticket.waitReason;
}

/** A row linking to the ticket; the detail line is the machine unless the section says more. */
function row(
  ticket: Ticket,
  machines: Config['machines'],
  time: string,
  detail?: string,
): TicketRowItem {
  const machine = machineLabel(ticket, machines);
  return { id: ticket.id, ref: ticket.ref, machine, detail: detail ?? machine, time };
}

/**
 * `/desk/mine` from the Mine window, the login and `/config`. Windows and the day report href come from v1's
 * `screens/desk/views.ts` (kept, imported: `closedLast30Days`, `dayReportHref`, `todayDate`); each card's quick
 * button from `components/actionSpecs.ts` `quickSpec` with `actorFrom(me)`.
 */
export function mineModel(input: MineInput, t: TFunction): MineModel {
  const { mine, me, config, now } = input;
  const machines = config?.machines ?? [];
  const actor = me ? actorFrom(me) : null;
  const card = (ticket: Ticket): MineCard => ({
    ticket,
    machine: machineLabel(ticket, machines),
    quick: actor ? quickSpec(ticket, actor) : null,
  });
  const inProgress = mine.items.filter((x) => x.status === 'working').map(card);
  const waiting = mine.items.filter((x) => x.status === 'waiting').map(card);
  const date = todayDate(new Date(now));
  return {
    state: mine.loading && mine.items.length === 0 ? 'loading' : mine.error ? 'error' : 'ready',
    error: mine.error,
    now,
    names: peopleNames(config?.people),
    inProgress,
    waiting,
    closed: closedLast30Days(mine.items, now).map((x) =>
      row(x, machines, elapsedLabel(x.closedAt ?? x.reportedAt, now)),
    ),
    empty: inProgress.length === 0 && waiting.length === 0 ? t('desk.mineEmpty') : null,
    dayReport: { href: dayReportHref(date), file: `day-report-${date}.pdf` },
    words: {
      inProgress: t('status.working'),
      waiting: t('status.waiting'),
      closed: t('desk.view.closed30d'),
      none: t('desk.view.none'),
      dayReport: t('desk.mine.dayReport'),
      dayReportError: t('desk.mine.dayReportError'),
    },
  };
}

function block(read: WindowRead, rows: () => TicketRowItem[], empty: string): WindowBlock {
  const state = read.loading ? 'loading' : read.error ? 'error' : 'ready';
  return { state, error: read.error, rows: state === 'ready' ? rows() : [], empty };
}

/** Who is on the single longest working job: its lead, its hands-on minutes, its machine. */
function longestLine(
  live: Ticket[],
  names: Record<string, string>,
  machines: Config['machines'],
  t: TFunction,
): TakeawayData | null {
  const top = live
    .filter((x) => x.status === 'working')
    .reduce<Ticket | undefined>(
      (a, b) => (a && (a.figures?.activeMin ?? 0) >= (b.figures?.activeMin ?? 0) ? a : b),
      undefined,
    );
  if (!top) return null;
  return {
    text: t('deskLists.takeaway.teamLongest', {
      name: (top.leadPersonId && names[top.leadPersonId]) || t('common.teamMember'),
      minutes: formatMinutes(top.figures?.activeMin),
      machine: machineLabel(top, machines),
    }),
    tone: 'neutral',
    tag: tagOf('neutral', (k) => t(k)),
    outlier: top.ref,
  };
}

function monthBlocks(closedRows: Ticket[], who: (personId: string) => string): MonthBlock[] {
  return monthlyTotals(closedRows).map(({ month, rows }) => ({
    month,
    label: monthLabel(month),
    rows: rows.map((r) => ({
      personId: r.personId,
      name: who(r.personId),
      primary: formatMinutes(r.primary),
      support: r.support > 0 ? formatMinutes(r.support) : null,
    })),
  }));
}

const ROLE_KEYS = { primary: 'role.primary', support: 'role.support' } as const;

/**
 * Working now (S28): each person on a working job with their crew role and minutes on it, the job with the most
 * hands-on time first and its lead first; then the paused jobs, longest wait first, with what they wait for. The lead
 * is the ticket's own; the others come from `/state/crew`.
 */
function workingRows(
  input: TeamInput,
  who: (personId: string) => string,
  t: TFunction,
): Pick<TeamModel, 'working' | 'paused'> {
  const { state, crew = [], config } = input;
  const machines = config?.machines ?? [];
  const active = state.open
    .filter((x) => x.status === 'working')
    .sort((a, b) => (b.figures?.activeMin ?? 0) - (a.figures?.activeMin ?? 0));
  const rowsOf = (ticket: Ticket, paused: boolean): WorkingRow[] => {
    const people: { personId: string; role: string }[] = [];
    if (ticket.leadPersonId) people.push({ personId: ticket.leadPersonId, role: t('role.lead') });
    for (const member of crew)
      if (member.ticketId === ticket.id && member.personId !== ticket.leadPersonId)
        people.push({ personId: member.personId, role: t(ROLE_KEYS[member.role]) });
    const stateText = paused
      ? `${t('status.waiting')} · ${waitText(ticket, config)}`
      : t('status.working');
    const base = { ticketId: ticket.id, ref: ticket.ref, machine: machineLabel(ticket, machines) };
    // A paused job nobody holds (handed over, not picked up) still shows, without a person.
    if (people.length === 0)
      return paused
        ? [
            {
              ...base,
              key: ticket.id,
              name: '—',
              role: '—',
              state: stateText,
              paused,
              minutes: '—',
            },
          ]
        : [];
    return people.map(({ personId, role }) => ({
      ...base,
      key: `${ticket.id}:${personId}`,
      name: who(personId),
      role,
      state: stateText,
      paused,
      minutes: formatMinutes(
        ticket.figures?.perPerson[personId] ??
          (personId === ticket.leadPersonId ? ticket.figures?.activeMin : 0),
      ),
    }));
  };
  return {
    working: active.flatMap((x) => rowsOf(x, false)),
    paused: waitingFirst(state.open).flatMap((x) => rowsOf(x, true)),
  };
}

/**
 * `/desk/team` from `/state`, `/state/crew` and the two windows. Totals come from `views.ts` (
 * `cancelledLast24h`, `closedLast30Days`, `monthlyTotals`); the Waiting list from `waitingFirst`; the takeaway
 * is computed here.
 */
export function teamModel(input: TeamInput, t: TFunction): TeamModel {
  const { state, config, cancelled, closed, now } = input;
  const machines = config?.machines ?? [];
  const names = peopleNames(config?.people);
  const who = (personId: string) => names[personId] ?? t('common.teamMember');
  const none = t('desk.view.none');
  const closedRows = closedLast30Days(closed.items, now);
  const closedBlock = block(
    closed,
    () => closedRows.map((x) => row(x, machines, elapsedLabel(x.closedAt ?? x.reportedAt, now))),
    none,
  );
  const months = closedBlock.state === 'ready' ? monthBlocks(closedRows, who) : [];
  return {
    ...workingRows(input, who, t),
    waiting: waitingFirst(state.open).map((x) =>
      row(x, machines, formatMinutes(x.figures?.waitMin), waitText(x, config)),
    ),
    notStarted: state.open
      .filter((x) => x.status === 'open')
      .map((x) => row(x, machines, elapsedLabel(x.reportedAt, now), x.problem)),
    cancelled: block(
      cancelled,
      () =>
        cancelledLast24h(cancelled.items, now).map((x) =>
          row(x, machines, elapsedLabel(new Date(ticketTime(x)).toISOString(), now)),
        ),
      none,
    ),
    closed: { ...closedBlock, months },
    takeaways: { 'desk.team': longestLine(state.open, names, machines, t) },
    words: {
      workingNow: t('desk.view.workingNow'),
      waiting: t('status.waiting'),
      notStarted: t('desk.view.notStarted'),
      cancelled: t('desk.view.cancelled24h'),
      closed: t('desk.view.closed30d'),
      monthly: t('desk.view.monthly'),
      none,
      nobody: t('desk.teamNowEmpty'),
    },
  };
}
