import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CommandAction, Ticket } from '../api.js';
import type { ActionSpec } from './actionSpecs.js';
import { elapsedLabel, formatDateTime, formatMinutes } from './format.js';
import { isFollow, timeLine, typeLine } from '../screens/desk/openLists.js';
import { StatusBadge } from './StatusBadge.js';
import { SeverityBadge } from './SeverityBadge.js';
import { SlaTimerSummary } from './SlaTimerSummary.js';

interface Props {
  ticket: Ticket;
  now: string;
  machineCode: string;
  quick: ActionSpec | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The desk's v3 card lines (who reported, the minutes so far); the floor leaves it out. */
  desk?: DeskInfo;
}

type DeskInfo = { reportedBy: string | null; timeZone?: string };

/** v3's two card lines: who reported it and when, then the coloured minutes so far. */
function DeskLines({ ticket, now, desk }: { ticket: Ticket; now: string; desk: DeskInfo }) {
  const { t } = useTranslation();
  const line = timeLine(ticket, now);
  const type = typeLine(ticket);
  const at = formatDateTime(ticket.reportedAt, desk.timeZone);
  return (
    <>
      <p className={`mt-2 text-sm font-semibold ${type.tone}`}>
        {t(type.key, { date: type.date ?? '' })}
      </p>
      <p className="mt-2 text-base text-neutral-900">{ticket.problem}</p>
      <div className="mt-2 flex items-start justify-between gap-3 text-sm">
        <span className="text-neutral-500">
          {desk.reportedBy
            ? t('deskLists.reportedBy', { at, who: desk.reportedBy })
            : t('deskLists.reported', { at })}
        </span>
        <span className="shrink-0 text-right font-semibold text-neutral-900">
          {t(line.key, {
            time: formatMinutes(line.minutes),
            since: line.since ? formatDateTime(line.since, desk.timeZone) : '',
          })}
        </span>
      </div>
    </>
  );
}

export function TicketCard({ ticket, now, machineCode, quick, pending, onQuick, desk }: Props) {
  const { t } = useTranslation();
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <Link to={`/desk/${ticket.id}`} className="block rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight">{ticket.ref}</p>
          <div className="flex items-center gap-1.5">
            {desk && ticket.urgent && ticket.kind === 'general' && (
              <span className="rounded-full bg-stopped/10 px-2.5 py-1 text-xs font-semibold text-stopped">
                {t('deskLists.urgent')}
              </span>
            )}
            <SeverityBadge severity={ticket.severity} />
            <StatusBadge status={ticket.status} />
            {desk && isFollow(ticket) && (
              <span className="rounded-full bg-running/10 px-2.5 py-1 text-xs font-semibold text-running">
                {t('deskLists.running')}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-600">{machineCode}</p>
        {desk ? (
          <DeskLines ticket={ticket} now={now} desk={desk} />
        ) : (
          <>
            <p className="mt-2 line-clamp-2 text-base text-neutral-900">{ticket.problem}</p>
            <p className="mt-2 text-sm text-neutral-500">
              {t('ticket.reportedAgo', { time: elapsedLabel(ticket.reportedAt, now) })}
            </p>
          </>
        )}
        <SlaTimerSummary ticket={ticket} />
      </Link>
      {quick && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onQuick(ticket, quick.action)}
          className="mt-3 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
        >
          {t(quick.label)}
        </button>
      )}
    </li>
  );
}
