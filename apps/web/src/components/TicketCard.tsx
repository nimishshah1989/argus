import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CommandAction, Ticket } from '../api.js';
import type { ActionSpec } from './actions.js';
import { elapsedLabel } from './format.js';
import { StatusBadge } from './StatusBadge.js';

interface Props {
  ticket: Ticket;
  now: string;
  machineCode: string;
  quick: ActionSpec | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

export function TicketCard({ ticket, now, machineCode, quick, pending, onQuick }: Props) {
  const { t } = useTranslation();
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <Link to={`/desk/${ticket.id}`} className="block rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight">{ticket.ref}</p>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-600">{machineCode}</p>
        <p className="mt-2 line-clamp-2 text-base text-neutral-900">{ticket.problem}</p>
        <p className="mt-2 text-sm text-neutral-500">
          {t('ticket.reportedAgo', { time: elapsedLabel(ticket.reportedAt, now) })}
        </p>
      </Link>
      {quick && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onQuick(ticket, quick.action)}
          className="mt-3 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
        >
          {quick.label}
        </button>
      )}
    </li>
  );
}
