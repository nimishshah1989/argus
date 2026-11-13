import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getConfig, getMe, listTickets, type Ticket } from '../../api.js';
import { actorFrom, offers } from '../../components/actionSpecs.js';
import { ShareButton } from '../../components/ShareButton.js';
import { CancelOwnForm } from './MyComplaints.js';

const CANCEL_ACTION = 'cancel';

function CancelOwnTicket({
  ticket,
  config,
  personId,
}: {
  ticket: Ticket;
  config: Parameters<typeof CancelOwnForm>[0]['config'];
  personId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return open ? (
    <CancelOwnForm
      ticket={ticket}
      config={config}
      personId={personId}
      onDone={() => setOpen(false)}
    />
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-2 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
    >
      {t('action.cancel')}
    </button>
  );
}

export function SentConfirmation({
  sentRef,
  onAnother,
}: {
  sentRef: string;
  onAnother: () => void;
}) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const actor = me.data ? actorFrom(me.data.user) : null;
  const raised = useQuery({
    queryKey: ['tickets', 'raised', personId],
    queryFn: () => listTickets({ raisedBy: personId, limit: 50 }),
    enabled: Boolean(personId),
    staleTime: 0,
  });
  const ticket = raised.data?.items.find((item) => item.ref === sentRef);
  const canCancel = Boolean(ticket && actor !== null && offers(ticket, actor, CANCEL_ACTION));

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{t('floor.reported')}</h1>
        <p className="mt-2 text-neutral-600">{t('floor.notified')}</p>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-accent">{sentRef}</p>
        {ticket && config.data && (
          <div className="mt-6">
            <ShareButton ticket={ticket} config={config.data} mode="short" />
          </div>
        )}
        {ticket && config.data && personId && canCancel && (
          <CancelOwnTicket ticket={ticket} config={config.data} personId={personId} />
        )}
        <button
          type="button"
          onClick={onAnother}
          className="mt-2 min-h-13 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90"
        >
          {t('floor.reportAnother')}
        </button>
        <Link to="/desk" className="mt-3 inline-block text-accent">
          {t('floor.viewOpen')}
        </Link>
      </div>
    </main>
  );
}
