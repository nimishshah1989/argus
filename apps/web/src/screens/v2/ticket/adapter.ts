import type { TFunction } from 'i18next';
import { shareText, waMeUrl } from '@uptimo/shared';
import type {
  BreakdownReport,
  Config,
  Ticket,
  TicketDetail,
  TicketEvent,
  TicketInterval,
} from '../../../api.js';
import {
  escalationLines,
  escalationLinks,
  maySetLadder,
} from '../../../components/escalation-history.js';
import {
  formatDateTime,
  formatMinutes,
  formatTime,
  machineLabel,
  peopleNames,
} from '../../../components/format.js';
import { downNow } from '../../../components/liveDowntime.js';
import { statusMeaning, type StatusRef } from '../../../ui/meaning.js';
import type { Tone } from '../../../ui/status/index.js';
import type { TakeawayData } from '../../../ui/v2/takeaway.js';
import { tagOf } from '../insight.js';
import {
  reportState,
  type HistoryLine,
  type MinuteFigure,
  type PersonLine,
  type TicketChip,
  type TicketFact,
  type TicketInput,
  type TicketModel,
} from './model.js';

const LIVE = ['open', 'working', 'waiting'];

const CLOSE_LABEL_KEYS = {
  report: 'close.report',
  no_report: 'close.noReport',
  done: 'close.done',
};

const KIND_KEYS = {
  stopped: 'detail.kind.stopped',
  support: 'detail.kind.support',
  general: 'detail.kind.general',
} as const;

const ROLE_LABEL_KEYS: Record<string, string> = {
  lead: 'role.lead',
  primary: 'role.primary',
  support: 'role.support',
};

/** The dot colour of each kind of event (the word beside it says the same thing). */
const TONES: Record<string, Tone> = {
  down: 'danger',
  stopped: 'danger',
  upgrade_kind: 'danger',
  escalate: 'danger',
  escalation_ack: 'ok',
  start: 'info',
  pickup: 'info',
  lockout_confirmed: 'ok',
  resume: 'info',
  join: 'info',
  lead: 'info',
  restore: 'info',
  pause: 'hold',
  transfer: 'moved',
  running: 'ok',
  close: 'ok',
  report: 'ok',
};

const LABEL_KEYS: Record<string, string> = {
  down: 'timeline.down',
  escalate: 'timeline.escalate',
  escalation_ack: 'timeline.escalationAck',
  start: 'timeline.start',
  pickup: 'timeline.pickup',
  update: 'timeline.update',
  pause: 'timeline.pause',
  resume: 'timeline.resume',
  transfer: 'timeline.transfer',
  join: 'timeline.join',
  leave: 'timeline.leave',
  lead: 'timeline.lead',
  running: 'timeline.running',
  stopped: 'timeline.stopped',
  upgrade_kind: 'timeline.upgrade',
  close: 'timeline.close',
  report: 'timeline.report',
  cancel: 'timeline.cancel',
  restore: 'timeline.restore',
  edit: 'timeline.edit',
  task: 'timeline.task',
  acknowledge: 'timeline.acknowledge',
  lockout_confirmed: 'timeline.lockoutConfirmed',
  tag_add: 'timeline.tagAdd',
  tag_remove: 'timeline.tagRemove',
};

/** What every part of the model reads: the words, the plant, the names and the page's clock. */
type Ctx = {
  t: TFunction;
  config?: Config;
  names: Record<string, string>;
  now: string;
};

const say = (c: Ctx) => c.t as (key: string) => string;

const fact = (label: string, value: string | null | undefined): TicketFact[] =>
  value ? [{ label, value }] : [];

const minutesFact = (label: string, value: number | null | undefined): TicketFact[] =>
  value == null ? [] : [{ label, value: formatMinutes(value) }];

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

/** The machine's type and cell, e.g. "Turning Center · Cell 6". */
function machineLineOf(ticket: Ticket, config?: Config): string | null {
  const machine = config?.machines.find((item) => item.id === ticket.machineId);
  const category = ticket.machineSnapshot?.category ?? machine?.category;
  const cell = ticket.machineSnapshot?.cell ?? machine?.cell;
  return [category, cell].filter(Boolean).join(' · ') || null;
}

/** The role's name; the catalogue spells `plant_head` as `plantHead`. */
function roleLabel(t: TFunction, role: string | null): string | null {
  if (!role) return null;
  const camel = role.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase());
  return t(`account.role.${camel}`, { defaultValue: role });
}

/** A time with who did it, e.g. "09:58 by Person 11 (Operator)". */
function atBy(t: TFunction, time: string, name?: string, role?: string | null): string {
  if (!name) return time;
  return role ? t('detail.byRole', { time, name, role }) : t('detail.by', { time, name });
}

/** The plant's word for what a paused ticket waits for. */
function waitLabel(c: Ctx, ticket: Ticket): string | undefined {
  if (!ticket.waitReason) return undefined;
  const item = (c.config?.lists.wait_reason ?? []).find(
    (entry) => entry.code === ticket.waitReason,
  );
  return item?.label ?? ticket.waitReason;
}

/** The downtime the page shows: the final figure, else the live one while open, else what finished stretches added. */
function downtimeOf(c: Ctx, ticket: Ticket): number | null {
  const figures = ticket.figures;
  if (!figures || ticket.kind !== 'stopped') return null;
  const live = LIVE.includes(ticket.status);
  return figures.downtimeMin ?? (live ? downNow(ticket, c.now) : figures.downAccMin);
}

function minutesFacts(c: Ctx, ticket: Ticket): TicketFact[] {
  const { t } = c;
  const figures = ticket.figures;
  if (!figures) return [];
  const downtime = downtimeOf(c, ticket);
  return [
    ...minutesFact(t('detail.fact.response'), figures.responseMin),
    {
      label: t('detail.fact.workTime'),
      value: formatMinutes(figures.activeMin),
      // v1's "{time} (running)" with the time taken out: the note sits beside the value, not in it.
      note: ticket.status === 'working' ? t('detail.running', { time: '' }).trim() : undefined,
    },
    { label: t('detail.fact.waiting'), value: formatMinutes(figures.waitMin) },
    ...(figures.vendorMin > 0 ? minutesFact(t('figures.vendorWait'), figures.vendorMin) : []),
    ...(figures.handoverWaitMin > 0
      ? minutesFact(t('figures.handoverWait'), figures.handoverWaitMin)
      : []),
    ...minutesFact(t('figures.followUp'), figures.followMin),
    ...(downtime == null
      ? []
      : [
          {
            label: t('detail.fact.downtime'),
            value: LIVE.includes(ticket.status)
              ? t('detail.soFar', { time: formatMinutes(downtime) })
              : formatMinutes(downtime),
          },
        ]),
  ];
}

/** Severity with the criticality snapshot it was derived from, e.g. "S1 (A)". */
function severityOf(ticket: Ticket): string | null {
  if (!ticket.severity) return null;
  return ticket.criticalitySnapshot
    ? `${ticket.severity} (${ticket.criticalitySnapshot})`
    : ticket.severity;
}

/** Type, who and when it was reported, severity, lead, place and when work started. */
function openingFacts(c: Ctx, ticket: Ticket): TicketFact[] {
  const { t, config } = c;
  const lead = (config?.people ?? []).find((person) => person.id === ticket.leadPersonId);
  const time = (iso: string | null) => (iso ? formatDateTime(iso, config?.timeZone) : null);
  const reporter = ticket.reportedByPersonId ? c.names[ticket.reportedByPersonId] : undefined;
  const started = time(ticket.startedAt);
  return [
    { label: t('detail.fact.type'), value: t(KIND_KEYS[ticket.kind]) },
    {
      label: t('detail.fact.reported'),
      value: atBy(
        t,
        formatDateTime(ticket.reportedAt, config?.timeZone),
        reporter,
        roleLabel(t, ticket.reportedByRole),
      ),
    },
    ...fact(t('ticket.fact.severity'), severityOf(ticket)),
    ...fact(t('ticket.fact.lead'), lead?.name),
    ...fact(t('ticket.fact.location'), ticket.location),
    ...fact(t('ticket.fact.workType'), ticket.workType),
    ...fact(t('detail.fact.workStarted'), started && atBy(t, started, lead?.name)),
    ...fact(t('ticket.fact.machineRunning'), time(ticket.machineRunningAt)),
  ];
}

/** Why it is paused, a handover, and how and when it closed. */
function closingFacts(c: Ctx, ticket: Ticket): TicketFact[] {
  const { t } = c;
  const closer = ticket.closedByPersonId ? c.names[ticket.closedByPersonId] : undefined;
  const closed = ticket.closedAt ? formatDateTime(ticket.closedAt, c.config?.timeZone) : null;
  return [
    ...fact(t('ticket.fact.pauseReason'), waitLabel(c, ticket)),
    ...fact(t('ticket.fact.handover'), ticket.handedOver ? t('ticket.fact.waitingPickup') : null),
    ...fact(t('ticket.fact.closed'), closed && atBy(t, closed, closer)),
    ...fact(
      t('ticket.fact.closedAs'),
      ticket.closeKind ? t(CLOSE_LABEL_KEYS[ticket.closeKind]) : null,
    ),
    ...fact(t('ticket.fact.closeNote'), ticket.closeNote),
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

function intervalMinutes(interval: TicketInterval, now: string): number {
  const end = interval.endedAt ? Date.parse(interval.endedAt) : Date.parse(now);
  return Math.max(0, Math.floor((end - Date.parse(interval.startedAt)) / 60000));
}

function peopleOf(c: Ctx, detail: TicketDetail): PersonLine[] {
  const { t } = c;
  const { people, intervals, events, ticket } = detail;
  // The lead is not a crew row; the screen lists them first, as the mockup does.
  const lead = ticket.leadPersonId
    ? [{ personId: ticket.leadPersonId, role: 'lead', leftAt: null as string | null }]
    : [];
  const members = [...lead, ...people.filter((member) => member.personId !== ticket.leadPersonId)];
  return members.map((member) => {
    const own = intervals.filter((interval) => interval.personId === member.personId);
    const joined =
      own.map((interval) => interval.startedAt).sort()[0] ??
      events.find((event) => event.actingPersonId === member.personId)?.at;
    const minutes =
      ticket.figures?.perPerson[member.personId] ??
      own.reduce((sum, interval) => sum + intervalMinutes(interval, c.now), 0);
    const role = t(ROLE_LABEL_KEYS[member.role] ?? member.role);
    const sub = joined
      ? t('detail.joined', { role, time: formatTime(joined, c.config?.timeZone) })
      : role;
    return {
      key: member.personId,
      name: c.names[member.personId] ?? t('common.teamMember'),
      sub: member.leftAt ? `${sub} · ${t('ticket.left')}` : sub,
      value: formatMinutes(minutes),
      minutes,
    };
  });
}

/** Who, the text, the escalation line, the steps confirmed and the reason, joined with " · ". */
function eventDetail(
  c: Ctx,
  event: TicketEvent,
  escalation: string | undefined,
  reasonLabels: Record<string, string>,
): string | undefined {
  const actor = event.actingPersonId ? c.names[event.actingPersonId] : undefined;
  // A lockout confirmation keeps the steps' wording in `reason`; it is what was confirmed, not a "Reason".
  const confirmedSteps = event.type === 'lockout_confirmed' ? event.reason : undefined;
  const reason =
    event.reason && event.reason !== event.text && !confirmedSteps
      ? c.t('timeline.reason', { reason: reasonLabels[event.reason] ?? event.reason })
      : undefined;
  // The report event's text is the problem, which the header already shows.
  const text = event.type === 'down' ? undefined : event.text;
  return [actor, text, escalation, confirmedSteps, reason].filter(Boolean).join(' · ') || undefined;
}

function historyOf(c: Ctx, events: TicketEvent[], canSetLadder: boolean): HistoryLine[] {
  const reasonLabels: Record<string, string> = {};
  for (const item of c.config?.lists.wait_reason ?? []) reasonLabels[item.code] = item.label;
  const escalation = escalationLines(events, c.names, c.t);
  const links = escalationLinks(events, canSetLadder);
  return events.map((event) => {
    const link = links.get(event.seq);
    return {
      key: event.seq,
      tone: TONES[event.type] ?? 'muted',
      title: c.t(LABEL_KEYS[event.type] ?? event.type),
      at: event.at,
      when: formatTime(event.at, c.config?.timeZone),
      detail: eventDetail(c, event, escalation.get(event.seq), reasonLabels),
      link: link ? { to: link.to, label: c.t(link.labelKey) } : undefined,
    };
  });
}

/** `ticket.minutes` carries the downtime figure (a loss while the machine has been down); `ticket.people` names who has the most time. */
function takeawaysOf(
  c: Ctx,
  machine: string,
  minutes: TicketModel['minutes'],
  rows: PersonLine[],
): TicketModel['takeaways'] {
  const note = (text: string, tone: TakeawayData['tone'], outlier?: string): TakeawayData => ({
    text,
    tone,
    tag: tagOf(tone, say(c)),
    outlier,
  });
  const down = minutes?.figures.find((figure) => figure.id === 'downtime');
  const work = minutes?.figures.find((figure) => figure.id === 'workTime');
  let minutesLine: TakeawayData | null = null;
  if (work && down) {
    const text = c.t('detail.takeaway.minutes', { machine, down: down.value, work: work.value });
    minutesLine = note(text, down.minutes > 0 ? 'loss' : 'neutral');
  } else if (work) {
    minutesLine = note(c.t('detail.takeaway.minutesNoDown', { work: work.value }), 'neutral');
  }
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
    takeaways: takeawaysOf(c, machine, minutes, rows),
  };
}
