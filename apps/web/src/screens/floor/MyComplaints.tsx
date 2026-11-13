import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  listTickets,
  type Config,
  type Machine,
  type Ticket,
} from '../../api.js';
import { actorFrom, offers, type ActionSpec } from '../../components/actionSpecs.js';
import { useTicketCommand } from '../../components/useTicketCommand.js';
import { ActionForm } from '../../components/ActionForm.js';
import { errorMessage, machineLabel } from '../../components/format.js';
import { TicketCard } from '../../components/TicketCard.js';

const CANCEL_ACTION = 'cancel';
const CANCEL_SPEC: ActionSpec = { action: CANCEL_ACTION, label: 'action.cancel', primary: false };

interface CancelProps {
  ticket: Ticket;
  config: Config;
  personId: string;
  onDone: () => void;
}

/** The reason form for the caller's own not-started ticket; the server checks the rule too. */
export function CancelOwnForm({ ticket, config, personId, onDone }: CancelProps) {
  const { run, error, pending } = useTicketCommand();
  return (
    <div className="mt-2 text-left">
      <ActionForm
        action={CANCEL_ACTION}
        personId={personId}
        kind={ticket.kind}
        config={config}
        pending={pending}
        onRun={(action, body) => run(ticket.id, action, body)}
        onDone={onDone}
      />
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {error}
        </p>
      )}
    </div>
  );
}

export function MyComplaints({ machines }: { machines: Machine[] }) {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const personId = me.data?.user.actingPersonId;
  const actor = me.data ? actorFrom(me.data.user) : null;
  const complaints = useQuery({
    queryKey: ['tickets', 'raised', personId],
    queryFn: () => listTickets({ raisedBy: personId, limit: 50 }),
    enabled: Boolean(personId),
    staleTime: 0,
  });
  const [cancelTicket, setCancelTicket] = useState<Ticket | null>(null);
  const tickets = complaints.data?.items ?? [];
  const now = new Date().toISOString();
  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-neutral-600">{t('floor.complaints')}</h2>
      {me.isLoading || complaints.isLoading ? (
        <p className="mt-2 text-neutral-500">{t('common.loading')}</p>
      ) : complaints.error ? (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(complaints.error)}
        </p>
      ) : tickets.length === 0 ? (
        <p className="mt-2 text-neutral-500">{t('floor.complaintsEmpty')}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              machineCode={machineLabel(ticket, machines)}
              quick={actor !== null && offers(ticket, actor, CANCEL_ACTION) ? CANCEL_SPEC : null}
              pending={false}
              onQuick={() => setCancelTicket(ticket)}
            />
          ))}
        </ul>
      )}
      {cancelTicket && config.data && personId && (
        <CancelOwnForm
          ticket={cancelTicket}
          config={config.data}
          personId={personId}
          onDone={() => setCancelTicket(null)}
        />
      )}
    </section>
  );
}
