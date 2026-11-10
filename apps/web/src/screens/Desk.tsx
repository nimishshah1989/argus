import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getConfig,
  getMe,
  getState,
  type CommandAction,
  type Machine,
  type Person,
  type Ticket,
} from '../api.js';
import { canWork, quickAction, useTicketCommand } from '../components/actions.js';
import { errorMessage, machineLabel } from '../components/format.js';
import { TicketCard } from '../components/TicketCard.js';

const GROUPS = [
  { kind: 'stopped' as const, title: 'Breakdowns', empty: 'No breakdowns.' },
  { kind: 'general' as const, title: 'Tasks', empty: 'No tasks.' },
  { kind: 'support' as const, title: 'Work', empty: 'No work requests.' },
];

function Counts({ open }: { open: Ticket[] }) {
  const counts = [
    { label: 'Open', value: open.length },
    { label: 'Stopped', value: open.filter((ticket) => ticket.kind === 'stopped').length },
    { label: 'Support', value: open.filter((ticket) => ticket.kind === 'support').length },
    { label: 'General', value: open.filter((ticket) => ticket.kind === 'general').length },
  ];
  return (
    <dl className="mt-4 grid grid-cols-4 gap-2">
      {counts.map((item) => (
        <div key={item.label} className="rounded-xl bg-white p-3 shadow-sm">
          <dt className="text-xs text-neutral-500">{item.label}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tracking-tight">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TeamNow({ open, people }: { open: Ticket[]; people: Person[] | undefined }) {
  const leads = new Map<string, string>();
  for (const ticket of open) {
    if (ticket.status !== 'working' || !ticket.leadPersonId) continue;
    const name = people?.find((person) => person.id === ticket.leadPersonId)?.name;
    if (name) leads.set(ticket.leadPersonId, name);
  }
  return (
    <section aria-label="Team now" className="mt-6">
      <h2 className="text-sm font-medium text-neutral-600">Team now</h2>
      {leads.size === 0 ? (
        <p className="mt-2 text-neutral-500">
          {people ? 'Nobody is working right now.' : 'Loading…'}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {[...leads].map(([id, name]) => (
            <li key={id} className="rounded-full bg-white px-3 py-2 text-sm font-medium shadow-sm">
              {name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ListProps {
  title: string;
  empty: string;
  tickets: Ticket[];
  machines: Machine[];
  now: string;
  canQuick: boolean;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

function TicketList({
  title,
  empty,
  tickets,
  machines,
  now,
  canQuick,
  pending,
  onQuick,
}: ListProps) {
  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-600">
        {title} <span className="text-neutral-400">({tickets.length})</span>
      </h2>
      {tickets.length === 0 ? (
        <p className="mt-2 text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              machineCode={machineLabel(ticket, machines)}
              quick={canQuick ? quickAction(ticket) : null}
              pending={pending}
              onQuick={onQuick}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function Desk() {
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useTicketCommand();
  const open = state.data?.open ?? [];
  const machines = config.data?.machines ?? [];
  const user = me.data?.user;
  const canQuick = canWork(user?.role);

  function quick(ticket: Ticket, action: CommandAction) {
    if (!user) return;
    void run(ticket.id, action, { personId: user.actingPersonId });
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <nav className="mb-6 flex gap-2">
        <Link
          to="/floor"
          className="inline-flex min-h-13 items-center rounded-lg px-4 font-medium text-neutral-600 hover:bg-neutral-200"
        >
          Report
        </Link>
        <Link
          to="/desk"
          className="inline-flex min-h-13 items-center rounded-lg bg-neutral-200 px-4 font-medium text-neutral-900"
        >
          Open
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">Open tickets</h1>
      <Counts open={open} />
      <TeamNow open={open} people={config.data?.people} />

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-stopped/10 p-3 text-stopped">
          {error}
        </p>
      )}
      {state.isLoading && !state.data && <p className="mt-6 text-neutral-500">Loading…</p>}
      {state.error && (
        <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(state.error)}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {GROUPS.map((group) => (
          <TicketList
            key={group.kind}
            title={group.title}
            empty={group.empty}
            tickets={open.filter((ticket) => ticket.kind === group.kind)}
            machines={machines}
            now={state.data?.now ?? new Date().toISOString()}
            canQuick={canQuick}
            pending={pending}
            onQuick={quick}
          />
        ))}
      </div>
    </main>
  );
}
