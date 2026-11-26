import type { TFunction } from 'i18next';
import type { Config, Ticket } from '../../../api.js';
import { formatDateTime, formatMinutes } from '../../../components/format.js';
import { downNow } from '../../../components/liveDowntime.js';
import { type TicketFact } from './model.js';

/** The ticket page's facts (opening, closing, minutes) and the context every part of `ticketModel` reads. */

export const LIVE = ['open', 'working', 'waiting'];

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

export const ROLE_LABEL_KEYS: Record<string, string> = {
  lead: 'role.lead',
  primary: 'role.primary',
  support: 'role.support',
};

/** What every part of the model reads: the words, the plant, the names and the page's clock. */
export type Ctx = {
  t: TFunction;
  config?: Config;
  names: Record<string, string>;
  now: string;
};

export const say = (c: Ctx) => c.t as (key: string) => string;

export const fact = (label: string, value: string | null | undefined): TicketFact[] =>
  value ? [{ label, value }] : [];

export const minutesFact = (label: string, value: number | null | undefined): TicketFact[] =>
  value == null ? [] : [{ label, value: formatMinutes(value) }];

/** The machine's type and cell, e.g. "Turning Center · Cell 6". */
export function machineLineOf(ticket: Ticket, config?: Config): string | null {
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
export function waitLabel(c: Ctx, ticket: Ticket): string | undefined {
  if (!ticket.waitReason) return undefined;
  const item = (c.config?.lists.wait_reason ?? []).find(
    (entry) => entry.code === ticket.waitReason,
  );
  return item?.label ?? ticket.waitReason;
}

/** The downtime the page shows: the final figure, else the live one while open, else what finished stretches added. */
export function downtimeOf(c: Ctx, ticket: Ticket): number | null {
  const figures = ticket.figures;
  if (!figures || ticket.kind !== 'stopped') return null;
  const live = LIVE.includes(ticket.status);
  return figures.downtimeMin ?? (live ? downNow(ticket, c.now) : figures.downAccMin);
}

export function minutesFacts(c: Ctx, ticket: Ticket): TicketFact[] {
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
export function openingFacts(c: Ctx, ticket: Ticket): TicketFact[] {
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
export function closingFacts(c: Ctx, ticket: Ticket): TicketFact[] {
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
