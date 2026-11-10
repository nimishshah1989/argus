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
    <main>
      <div className="tabs">
        <Link to="/floor">Report</Link>
        <Link to="/desk">Open</Link>
      </div>
      <h1>Open tickets</h1>
      {tickets.length === 0 && <p>Nothing open.</p>}
      {tickets.map((ticket) => (
        <div className="card" key={ticket.id}>
          <strong>{ticket.ref}</strong>
          <p>{ticket.problem}</p>
          <small>{ticket.reported_at}</small>
        </div>
      ))}
    </main>
  );
}
