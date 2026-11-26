/* eslint-disable i18next/no-literal-string -- prop values, ids, tones and routes only; every visible string goes through t() */
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { type CommandAction, type Ticket } from '../../../api.js';
import type { ActionSpec } from '../../../components/actionSpecs.js';
import { formatMinutes, formatTime } from '../../../components/format.js';
import { Button } from '../../../ui/v2/button.js';
import { StatusPill } from '../../../ui/v2/status-pill.js';
import { timeLine, typeLine } from '../../desk/openLists.js';
import { SlaTimers } from '../ticket/SlaTimers.js';

/** The desk's ticket and plain rows and the list a row opens beside; `parts.tsx` re-exports them. */

/** Where a list row came from, so a wide screen opens the ticket beside that list and Close goes back to it. */
export type FromList = { from: string };

/** The list a row sits on: the page's own address, or, while a ticket is open beside it, the list it came from. */
export function useFrom(): FromList {
  const location = useLocation();
  const from = (location.state as Partial<FromList> | null)?.from;
  return { from: from ?? location.pathname };
}

type ChipId = 'stopped' | 'in_progress' | 'support' | 'waiting' | 'transferred' | 'running';

/** The status a row shows (design lock status table). */
export function chipFor(ticket: Ticket): ChipId | null {
  if (ticket.status === 'waiting') return 'waiting';
  if (ticket.status === 'working') return 'in_progress';
  if (ticket.handedOver) return 'transferred';
  if (ticket.kind === 'support') return 'support';
  if (ticket.kind === 'stopped') return ticket.machineRunningAt ? 'running' : 'stopped';
  return null;
}

/** Ticket 31: the ladder's state on the row, one line, only once a step was told. */
function escalationLine(ticket: Ticket, t: TFunction): { text: string; late: boolean } | null {
  const state = ticket.escalation;
  if (!state?.lastLevel) return null;
  const waiting = state.pendingLevels.length > 0;
  return {
    text: t(waiting ? 'escalation.cardWaiting' : 'escalation.cardTold', { level: state.lastLevel }),
    late: waiting,
  };
}

/** Severity S1–S4 on the kit tints; the label is always printed, so colour never works alone. */
const SEVERITY: Record<string, string> = {
  S1: 'v2-pill-loss',
  S2: 'v2-pill-decide',
  S3: 'v2-pill-risk',
  S4: 'v2-pill-neutral',
};

const TIME_LATE = new Set(['deskLists.time.down']);

/** Severity S1–S4 as a pill with its label; nothing when the ticket has none. */
function SeverityPill({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return <span className={`v2-pill ${SEVERITY[severity] ?? 'v2-pill-neutral'}`}>{severity}</span>;
}

/** The cells of a ticket row, inside its link. */
function TicketCells({
  ticket,
  now,
  machine,
  names,
  longest,
}: {
  ticket: Ticket;
  now: string;
  machine: string;
  names: Record<string, string>;
  longest?: string;
}) {
  const { t } = useTranslation();
  const kind = typeLine(ticket);
  const time = timeLine(ticket, now);
  const chip = chipFor(ticket);
  const who = ticket.reportedByPersonId ? names[ticket.reportedByPersonId] : undefined;
  const at = formatTime(ticket.reportedAt);
  const escalation = escalationLine(ticket, t);
  return (
    <>
      <span className="v2-desk-main">
        <span className="v2-h3">{machine}</span>
        <span className="v2-sub">{ticket.ref}</span>
      </span>
      <span className="v2-desk-tags">
        <SeverityPill severity={ticket.severity} />
        {chip ? <StatusPill group="ticket" id={chip} /> : null}
      </span>
      <span className="v2-desk-what">
        <span className="v2-sub">{t(kind.key, { date: kind.date })}</span>
        <span>{ticket.problem}</span>
        <span className="v2-sub">
          {who ? t('deskLists.reportedBy', { at, who }) : t('deskLists.reported', { at })}
        </span>
      </span>
      <span className="v2-desk-time">
        <span className="v2-num" data-late={TIME_LATE.has(time.key) || undefined}>
          {t(time.key, {
            time: formatMinutes(time.minutes),
            since: time.since ? formatTime(time.since) : '',
          })}
        </span>
        {longest ? <span className="v2-pill v2-pill-loss">{longest}</span> : null}
      </span>
      <span className="v2-desk-clocks">
        <SlaTimers ticket={ticket} />
        {escalation ? (
          <span className="v2-sub" data-late={escalation.late || undefined}>
            {escalation.text}
          </span>
        ) : null}
      </span>
    </>
  );
}

/**
 * One ticket on a desk list (v1 `TicketCard`, a kit row: the columns of a table on a wide screen, a card on a phone):
 * machine and ref, severity and status, the kind of job, the problem, who reported it and when, how long, the two
 * clocks, the ladder, and its one quick button. The row's link opens the ticket; the quick button is apart from it.
 */
export function TicketRow({
  ticket,
  now,
  machine,
  names = {},
  quick,
  pending,
  onQuick,
  longest,
}: {
  ticket: Ticket;
  now: string;
  machine: string;
  names?: Record<string, string>;
  quick: ActionSpec | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The "Longest" tag (the worst row, marked). */
  longest?: string;
}) {
  const { t } = useTranslation();
  const from = useFrom();
  return (
    <li className="v2-desk-row">
      <NavLink to={`/desk/${ticket.id}`} state={from} className="v2-desk-link">
        <TicketCells ticket={ticket} now={now} machine={machine} names={names} longest={longest} />
      </NavLink>
      <span className="v2-desk-quick">
        {quick ? (
          <Button disabled={pending} onClick={() => onQuick(ticket, quick.action)}>
            {t(quick.label)}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/** A plain desk row (a closed or waiting ticket): ref, machine, a detail line, and a time on the right. */
export function PlainRow({
  id,
  title,
  lines,
  time,
  status,
  action,
}: {
  id: string;
  title: string;
  lines: string[];
  time?: string;
  /** A status pill, after the title and the first line (where v1's card had it). */
  status?: ReactNode;
  action?: ReactNode;
}) {
  const from = useFrom();
  const [first, ...rest] = lines.filter(Boolean);
  return (
    <li className="v2-desk-row">
      <Link to={`/desk/${id}`} state={from} className="v2-desk-link">
        <span className="v2-desk-main">
          <span className="v2-h3">{title}</span>
          {first ? <span className="v2-sub">{first}</span> : null}
          {status}
          {rest.map((line) => (
            <span key={line} className="v2-sub">
              {line}
            </span>
          ))}
        </span>
        {time ? <span className="v2-sub v2-desk-time">{time}</span> : null}
      </Link>
      {action ? <span className="v2-desk-quick">{action}</span> : null}
    </li>
  );
}
