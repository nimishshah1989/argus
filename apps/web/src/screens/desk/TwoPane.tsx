import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketDetail } from '../TicketDetail.js';

/** The Open list on the left and the chosen ticket (or a hint) on the right. */
export function TwoPane({ list, ticketId }: { list: ReactNode; ticketId: string | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start gap-4">
      <div>{list}</div>
      <section
        aria-label={t('deskWide.ticket')}
        className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl bg-surface shadow-card"
      >
        {ticketId ? (
          <TicketDetail embedded />
        ) : (
          <p className="p-6 text-body text-neutral-600">{t('deskWide.pickTicket')}</p>
        )}
      </section>
    </div>
  );
}
