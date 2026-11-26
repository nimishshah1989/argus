import type { TicketDetail, TicketEvent, TicketInterval } from '../../../api.js';
import { escalationLines, escalationLinks } from '../../../components/escalation-history.js';
import { formatMinutes, formatTime } from '../../../components/format.js';
import type { Tone } from '../../../ui/status/index.js';
import { type HistoryLine, type PersonLine } from './model.js';
import { ROLE_LABEL_KEYS, type Ctx } from './adapter-facts.js';

/** The ticket page's People and History rows, for `ticketModel`. */

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

function intervalMinutes(interval: TicketInterval, now: string): number {
  const end = interval.endedAt ? Date.parse(interval.endedAt) : Date.parse(now);
  return Math.max(0, Math.floor((end - Date.parse(interval.startedAt)) / 60000));
}

export function peopleOf(c: Ctx, detail: TicketDetail): PersonLine[] {
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
    return {
      key: member.personId,
      name: c.names[member.personId] ?? t('common.teamMember'),
      value: formatMinutes(minutes),
      minutes,
      ...personColumns(c, member, joined),
    };
  });
}

/** The People row's role, joined and left, and the one line ("Lead · joined 10:55 · left") they make together. */
function personColumns(
  c: Ctx,
  member: { role: string; leftAt: string | null },
  joined: string | undefined,
): Pick<PersonLine, 'sub' | 'role' | 'joined' | 'left'> {
  const { t } = c;
  const role = t(ROLE_LABEL_KEYS[member.role] ?? member.role);
  const joinedAt = joined ? formatTime(joined, c.config?.timeZone) : null;
  const sub = joinedAt ? t('detail.joined', { role, time: joinedAt }) : role;
  return {
    sub: member.leftAt ? `${sub} · ${t('ticket.left')}` : sub,
    role,
    joined: joinedAt,
    left: member.leftAt ? formatTime(member.leftAt, c.config?.timeZone) : null,
  };
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

export function historyOf(c: Ctx, events: TicketEvent[], canSetLadder: boolean): HistoryLine[] {
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
