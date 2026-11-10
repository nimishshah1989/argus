import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

interface Ticket {
  id: string;
  ref: string;
  problem: string;
  reported_at: string;
}
interface State {
  open: Ticket[];
  now: string;
}

export function Desk() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    api<State>('/api/v1/state')
      .then((state) => setTickets(state.open))
      .catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <nav className="mb-6 flex gap-2">
        <Link
          to="/floor"
          className="rounded-lg px-4 py-2 font-medium text-neutral-600 hover:bg-neutral-200"
        >
          Report
        </Link>
        <Link
          to="/desk"
          className="rounded-lg bg-neutral-200 px-4 py-2 font-medium text-neutral-900"
        >
          Open
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Open tickets</h1>
      {tickets.length === 0 && <p className="mt-4 text-neutral-500">Nothing open.</p>}
      {tickets.map((ticket) => (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4" key={ticket.id}>
          <strong className="text-base">{ticket.ref}</strong>
          <p className="mt-1">{ticket.problem}</p>
          <small className="text-neutral-500">{ticket.reported_at}</small>
        </div>
      ))}
    </main>
  );
}
