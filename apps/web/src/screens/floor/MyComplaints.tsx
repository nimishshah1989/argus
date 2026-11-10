import { useQuery } from '@tanstack/react-query';
import { getMe, listTickets, type Machine } from '../../api.js';
import { errorMessage, machineLabel } from '../../components/format.js';
import { TicketCard } from '../../components/TicketCard.js';

export function MyComplaints({ machines }: { machines: Machine[] }) {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const complaints = useQuery({
    queryKey: ['tickets', 'raised', personId],
    queryFn: () => listTickets({ raisedBy: personId, limit: 50 }),
    enabled: Boolean(personId),
    staleTime: 0,
  });
  const tickets = complaints.data?.items ?? [];
  const now = new Date().toISOString();
  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-neutral-600">My complaints</h2>
      {me.isLoading || complaints.isLoading ? (
        <p className="mt-2 text-neutral-500">Loading…</p>
      ) : complaints.error ? (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(complaints.error)}
        </p>
      ) : tickets.length === 0 ? (
        <p className="mt-2 text-neutral-500">You have not reported anything yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              machineCode={machineLabel(ticket, machines)}
              quick={null}
              pending={false}
              onQuick={() => undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
