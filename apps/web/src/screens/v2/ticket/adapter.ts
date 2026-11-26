import type { TFunction } from 'i18next';
import { shareText, waMeUrl } from '@uptimo/shared';
import type { BreakdownReport, Ticket, TicketDetail, TicketEvent } from '../../../api.js';
import { maySetLadder } from '../../../components/escalation-history.js';
import {
  formatMinutes,
  formatTime,
  machineLabel,
  peopleNames,
} from '../../../components/format.js';
import { statusMeaning, type StatusRef } from '../../../ui/meaning.js';
import type { TakeawayData } from '../../../ui/v2/takeaway.js';
import { tagOf } from '../insight.js';
import {
  reportState,
  type MinuteFigure,
  type PersonLine,
  type TicketChip,
  type TicketInput,
  type TicketModel,
} from './model.js';
import {
  LIVE,
  type Ctx,
  say,
  fact,
  minutesFact,
  machineLineOf,
  waitLabel,
  downtimeOf,
  minutesFacts,
  openingFacts,
  closingFacts,
} from './adapter-facts.js';
import { peopleOf, historyOf } from './adapter-history.js';

const chip = (ref: StatusRef, t: TFunction): TicketChip => ({
  ...ref,
  text: t(statusMeaning(ref).label),
});

function statusRef(ticket: Ticket): StatusRef {
  switch (ticket.status) {
    case 'open':
      return ticket.handedOver
        ? { group: 'ticket', id: 'transferred' }
        : { group: 'floor', id: 'booked' };
    case 'working':
      return { group: 'ticket', id: 'in_progress' };
    case 'waiting':
      return { group: 'ticket', id: 'waiting' };
    case 'closed':
      return { group: 'ticket', id: 'closed' };
    default:
      return { group: 'ticket', id: 'cancelled' };
  }
}

function chipsOf(detail: TicketDetail, t: TFunction): TicketChip[] {
  const { ticket } = detail;
  const report = reportState(detail);
  return [
    ...(LIVE.includes(ticket.status) && ticket.kind !== 'general'
      ? [chip({ group: 'ticket', id: ticket.kind }, t)]
      : []),
    chip(statusRef(ticket), t),
    ...(report
      ? [chip({ group: 'report', id: report === 'with' ? 'with_report' : 'needs_report' }, t)]
      : []),
  ];
}

function personList(c: Ctx, report: BreakdownReport, role: 'done' | 'supported'): string | null {
  const ids = report.people
    .filter((person) => person.role === role)
    .map((person) => person.personId);
  return ids.length === 0
    ? null
    : ids.map((id) => c.names[id] ?? c.t('common.teamMember')).join(', ');
}

function reportCardOf(c: Ctx, report: BreakdownReport | null): TicketModel['report'] {
  const { t } = c;
  // A PM job's report is its checklist, drawn by the View's PmReportCard.
  if (!report || report.pmReport) return null;
  return {
    heading: t('report.title'),
    rows: [
      ...fact(t('report.problem'), report.problem),
      ...fact(t('report.observedBy'), report.observedBy),
      ...fact(t('report.correctiveAction'), report.correctiveAction),
      ...fact(t('report.doneBy'), personList(c, report, 'done')),
      ...fact(t('report.supportedBy'), personList(c, report, 'supported')),
      ...fact(t('report.downtime'), formatMinutes(report.downtimeMin)),
      ...minutesFact(t('report.response'), report.responseMin),
      ...minutesFact(t('report.repair'), report.repairMin),
      ...fact(t('report.category'), report.breakdownCategory),
      ...fact(t('report.maintenanceCode'), report.maintCode),
      ...fact(t('report.spareUsed'), report.spareUsed),
      ...fact(t('report.rootCause'), report.rootCause),
      ...fact(t('report.handoverTo'), report.handoverName),
      ...fact(t('report.date'), report.date),
      ...fact(t('report.shift'), report.shiftCode),
    ],
  };
}

function minutesCardOf(c: Ctx, ticket: Ticket): TicketModel['minutes'] {
  const { t } = c;
  const figures = ticket.figures;
  if (!figures) return null;
  const elapsed = Math.max(
    0,
    Math.floor((Date.parse(ticket.closedAt ?? c.now) - Date.parse(ticket.reportedAt)) / 60000),
  );
  const yardstick = t('detail.sinceReported', { total: formatMinutes(elapsed) });
  const down = downtimeOf(c, ticket);
  const figure = (
    id: MinuteFigure['id'],
    label: string,
    minutes: number,
    hint?: string,
  ): MinuteFigure => ({ id, label, value: formatMinutes(minutes), hint, yardstick, minutes });
  return {
    heading: t('detail.minutes'),
    figures: [
      ...(down === null
        ? []
        : [figure('downtime', t('detail.tile.downtime'), down, t('detail.hint.stopped'))]),
      figure('workTime', t('detail.tile.workTime'), figures.activeMin, t('detail.hint.handsOn')),
      figure('waiting', t('detail.tile.waiting'), figures.waitMin, waitLabel(c, ticket)),
    ],
  };
}

/** `ticket.minutes` carries the downtime figure (a loss while the machine has been down); `ticket.people` names who has the most time. */
function noteOf(c: Ctx, text: string, tone: TakeawayData['tone'], outlier?: string): TakeawayData {
  return { text, tone, tag: tagOf(tone, say(c)), outlier };
}

/**
 * `ticket.minutes`: the downtime against the machine's own average, over or under it, or that the machine has
 * no history to compare with; a reply without the average (an older server) keeps the plain line.
 */
function minutesLineOf(
  c: Ctx,
  machine: string,
  minutes: TicketModel['minutes'],
  average: TicketDetail['machineAverage'],
): TakeawayData | null {
  const down = minutes?.figures.find((figure) => figure.id === 'downtime');
  const work = minutes?.figures.find((figure) => figure.id === 'workTime');
  if (!work) return null;
  if (!down)
    return noteOf(c, c.t('detail.takeaway.minutesNoDown', { work: work.value }), 'neutral');
  const words = { machine, down: down.value, work: work.value };
  const tone = down.minutes > 0 ? 'loss' : 'neutral';
  if (average === undefined) return noteOf(c, c.t('detail.takeaway.minutes', words), tone);
  if (average === null) return noteOf(c, c.t('detail.takeaway.minutesNoHistory', words), tone);
  const gap = down.minutes - average.downtimeMin;
  const text = c.t(gap > 0 ? 'detail.takeaway.minutesOver' : 'detail.takeaway.minutesUnder', {
    ...words,
    diff: formatMinutes(Math.abs(gap)),
    avg: formatMinutes(average.downtimeMin),
  });
  return noteOf(c, text, down.minutes > 0 && gap >= 0 ? 'loss' : 'neutral');
}

function takeawaysOf(
  c: Ctx,
  minutesLine: TakeawayData | null,
  rows: PersonLine[],
): TicketModel['takeaways'] {
  const note = (text: string, tone: TakeawayData['tone'], outlier?: string) =>
    noteOf(c, text, tone, outlier);
  const top = rows.reduce<PersonLine | undefined>(
    (best, row) => (best && best.minutes >= row.minutes ? best : row),
    undefined,
  );
  return {
    'ticket.minutes': minutesLine,
    'ticket.people': top
      ? note(
          c.t('detail.takeaway.people', { name: top.name, minutes: top.value }),
          'neutral',
          top.key,
        )
      : null,
  };
}

/** "Acknowledged by {who} · {time}" from the newest acknowledge event. */
function acknowledgedBy(c: Ctx, events: TicketEvent[]): string | null {
  const ack = [...events].reverse().find((event) => event.type === 'acknowledge');
  if (!ack) return null;
  return c.t('sla.acknowledgedBy', {
    who: (ack.actingPersonId && c.names[ack.actingPersonId]) || c.t('common.teamMember'),
    time: formatTime(ack.at, c.config?.timeZone),
  });
}

/**
 * The `/tickets/:id` reply (+ config, login, clock, brand) → the read part of the ticket page. Pure: same input, same
 * model. Facts and figures through v1's pure helpers (`liveDowntime.ts`, `escalation-history.ts`, `format.ts`).
 */
export function ticketModel(input: TicketInput, t: TFunction): TicketModel {
  const { detail, config, me, now, brand } = input;
  const { ticket } = detail;
  const c: Ctx = { t, config, names: peopleNames(config?.people), now };
  const machine = machineLabel(ticket, config?.machines);
  const general = ticket.kind === 'general';
  const minutes = minutesCardOf(c, ticket);
  const rows = peopleOf(c, detail);
  return {
    back: { to: '/desk', label: t('detail.back') },
    title: general ? ticket.ref : machine,
    ref: general ? null : ticket.ref,
    chips: chipsOf(detail, t),
    machineLine: machineLineOf(ticket, config),
    problem: ticket.problem,
    acknowledgedBy: acknowledgedBy(c, detail.events),
    facts: [...openingFacts(c, ticket), ...minutesFacts(c, ticket), ...closingFacts(c, ticket)],
    report: reportCardOf(c, detail.report),
    share: {
      label: t('share.send'),
      href: waMeUrl(shareText(ticket, { ...config, tenantName: brand }, 'full')),
    },
    minutes,
    people: { heading: t('detail.people'), rows, empty: t('ticket.peopleEmpty') },
    history: {
      heading: t('detail.history'),
      rows: historyOf(c, detail.events, maySetLadder(me?.role)),
      empty: t('timeline.empty'),
    },
    takeaways: takeawaysOf(c, minutesLineOf(c, machine, minutes, detail.machineAverage), rows),
  };
}
