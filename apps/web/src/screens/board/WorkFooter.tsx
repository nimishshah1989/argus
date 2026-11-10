import type { Machine, Ticket } from '../../api.js';
import { machineLabel } from '../../components/format.js';

export function WorkFooter({
  open,
  machines,
  large,
}: {
  open: Ticket[];
  machines: Machine[];
  large: boolean;
}) {
  const work = open.filter((ticket) => ticket.kind === 'general');
  return (
    <section aria-label="Work requests" className="mt-8">
      <h2 className={`font-semibold tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}>
        Work requests <span className="text-neutral-400">({work.length})</span>
      </h2>
      {work.length === 0 ? (
        <p className={`mt-2 text-neutral-500 ${large ? 'text-lg' : 'text-sm'}`}>
          No work requests.
        </p>
      ) : (
        <ul className={`mt-3 grid gap-2 sm:grid-cols-2 ${large ? 'text-lg' : 'text-sm'}`}>
          {work.map((ticket) => (
            <li key={ticket.id} className="rounded-xl bg-white p-3 shadow-sm">
              <p>
                <span className="font-medium">{ticket.ref}</span>
                <span className="text-neutral-500"> · {machineLabel(ticket, machines)}</span>
              </p>
              <p className="mt-1 text-neutral-700">{ticket.problem}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
