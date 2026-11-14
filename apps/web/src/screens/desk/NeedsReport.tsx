/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import { formatDateTime, machineLabel } from '../../components/format.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { TicketCard } from '../../ui/ticket-card.js';
import type { CardContext } from './Board.js';
import { ListHeading } from './parts.js';

/** "Closed without a report" (SPEC 1.6): seven days of reports still owed; hidden when there are none. */
export function NeedsReport({ tickets, ctx }: { tickets: Ticket[]; ctx: CardContext }) {
  const { t } = useTranslation();
  if (tickets.length === 0) return null;
  return (
    <section aria-label={t('desk.needsReport')} className="flex flex-col gap-2">
      <ListHeading>{t('deskLists.needsReport', { count: tickets.length })}</ListHeading>
      <p className="text-footnote text-neutral-600">{t('deskLists.needsReport.hint')}</p>
      <ul className="flex flex-col gap-3">
        {tickets.map((ticket) => {
          const at = ticket.closedAt ? formatDateTime(ticket.closedAt) : '';
          const who = ticket.closedByPersonId ? ctx.names[ticket.closedByPersonId] : undefined;
          return (
            <li key={ticket.id}>
              <TicketCard
                to={`/desk/${ticket.id}`}
                title={machineLabel(ticket, ctx.machines)}
                refLabel={ticket.ref}
                status={<StatusPill group="report" id="needs_report" />}
                problem={ticket.problem}
                meta={who ? t('deskLists.closedBy', { at, who }) : t('deskLists.closed', { at })}
              >
                <Link
                  to={`/desk/${ticket.id}`}
                  className="flex min-h-target items-center justify-center rounded-xl bg-accent-tint px-4 text-body font-semibold text-accent-text"
                >
                  {t('deskLists.fillReport')}
                </Link>
              </TicketCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
