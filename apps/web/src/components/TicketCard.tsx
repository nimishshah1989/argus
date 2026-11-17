/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { CommandAction, Ticket } from '../api.js';
import { Button } from '../ui/button.js';
import { Hourglass, LifeBuoy, OctagonX, Wrench, type IconComponent } from '../ui/icon.js';
import { TONE_TEXT } from '../ui/meaning.js';
import type { Tone } from '../ui/status/index.js';
import { StatusPill } from '../ui/status/status-pill.js';
import { TicketCard as Card } from '../ui/ticket-card.js';
import { timeLine, typeLine } from '../screens/desk/openLists.js';
import type { ActionSpec } from './actionSpecs.js';
import { formatMinutes, formatTime } from './format.js';
import { SeverityBadge } from './SeverityBadge.js';
import { SlaTimerSummary } from './SlaTimerSummary.js';

const TIME_TONE = {
  'deskLists.time.down': 'danger',
  'deskLists.time.waiting': 'hold',
  'deskLists.time.open': 'info',
  'deskLists.time.follow': 'ok',
} as const;

type ChipId = 'stopped' | 'in_progress' | 'support' | 'waiting' | 'transferred' | 'running';

/** The status chip a card shows (design lock status table). */
export function chipFor(ticket: Ticket): ChipId | null {
  if (ticket.status === 'waiting') return 'waiting';
  if (ticket.status === 'working') return 'in_progress';
  if (ticket.handedOver) return 'transferred';
  if (ticket.kind === 'support') return 'support';
  if (ticket.kind === 'stopped') return ticket.machineRunningAt ? 'running' : 'stopped';
  return null;
}

const KIND_ICON: Record<string, IconComponent> = {
  danger: OctagonX,
  warning: LifeBuoy,
  ok: Wrench,
  info: Wrench,
};

/** Ticket 31: the ladder's state on the card, one line, only once a step was told. */
function escalationLine(ticket: Ticket, t: TFunction): { text: string; tone: Tone } | null {
  const state = ticket.escalation;
  if (!state?.lastLevel) return null;
  const waiting = state.pendingLevels.length > 0;
  return {
    text: t(waiting ? 'escalation.cardWaiting' : 'escalation.cardTold', { level: state.lastLevel }),
    tone: waiting ? 'danger' : 'hold',
  };
}

interface Props {
  ticket: Ticket;
  now: string;
  machineCode: string;
  names?: Record<string, string>;
  quick: ActionSpec | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

/** A ticket on the desk lists: what kind of job, the problem, who reported it, how long, and its one quick action. */
export function TicketCard({
  ticket,
  now,
  machineCode,
  names = {},
  quick,
  pending,
  onQuick,
}: Props) {
  const { t } = useTranslation();
  const kind = typeLine(ticket);
  const time = timeLine(ticket, now);
  const chip = chipFor(ticket);
  const who = ticket.reportedByPersonId ? names[ticket.reportedByPersonId] : undefined;
  const at = formatTime(ticket.reportedAt);
  const escalation = escalationLine(ticket, t);
  return (
    <Card
      to={`/desk/${ticket.id}`}
      title={machineCode}
      refLabel={ticket.ref}
      status={
        <span className="flex shrink-0 items-center gap-1">
          <SeverityBadge severity={ticket.severity} />
          {chip ? <StatusPill group="ticket" id={chip} /> : null}
        </span>
      }
      kind={{
        text: t(kind.key, { date: kind.date }),
        tone: kind.tone,
        icon: ticket.status === 'waiting' ? Hourglass : KIND_ICON[kind.tone],
      }}
      problem={ticket.problem}
      meta={who ? t('deskLists.reportedBy', { at, who }) : t('deskLists.reported', { at })}
      time={{
        text: t(time.key, {
          time: formatMinutes(time.minutes),
          since: time.since ? formatTime(time.since) : '',
        }),
        tone: TIME_TONE[time.key],
      }}
      extra={
        <>
          <SlaTimerSummary ticket={ticket} />
          {escalation ? (
            <span className={`block text-footnote font-bold ${TONE_TEXT[escalation.tone]}`}>
              {escalation.text}
            </span>
          ) : null}
        </>
      }
    >
      {quick ? (
        <Button variant="tonal" disabled={pending} onClick={() => onQuick(ticket, quick.action)}>
          {t(quick.label)}
        </Button>
      ) : null}
    </Card>
  );
}
