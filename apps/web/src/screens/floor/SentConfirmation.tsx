import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getConfig, getMe, listTickets } from '../../api.js';
import { ShareButton } from '../../components/ShareButton.js';

export function SentConfirmation({
  sentRef,
  onAnother,
}: {
  sentRef: string;
  onAnother: () => void;
}) {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const raised = useQuery({
    queryKey: ['tickets', 'raised', personId],
    queryFn: () => listTickets({ raisedBy: personId, limit: 50 }),
    enabled: Boolean(personId),
    staleTime: 0,
  });
  const ticket = raised.data?.items.find((item) => item.ref === sentRef);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Reported</h1>
        <p className="mt-2 text-neutral-600">Maintenance has been notified.</p>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-accent">{sentRef}</p>
        {ticket && config.data && (
          <div className="mt-6">
            <ShareButton ticket={ticket} config={config.data} mode="short" />
          </div>
        )}
        <button
          type="button"
          onClick={onAnother}
          className="mt-2 min-h-13 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90"
        >
          Report another
        </button>
        <Link to="/desk" className="mt-3 inline-block text-accent">
          View open tickets
        </Link>
      </div>
    </main>
  );
}
