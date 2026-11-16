import { plantDay } from './plant-day.js';
import type { EngineData, TicketRow } from './types.js';

/** What a ticket looked like at the end of `asOf`: one closed later was still open then. */
function ticketAsOf(ticket: TicketRow, asOf: string, timeZone: string): TicketRow {
  if (ticket.status !== 'closed' || !ticket.closedAt) return ticket;
  if (plantDay(ticket.closedAt, timeZone) <= asOf) return ticket;
  return { ...ticket, status: 'open', closedAt: null, downtimeMin: null, repairMin: null };
}

/**
 * The plant as it stood at the end of the plant date `asOf`, so no engine re-implements the cut. A ticket is in if it
 * was reported on or before that plant day (in the plant's time zone, never the machine's); one closed after it was
 * still open, and its report did not exist yet. A report is in by its breakdown date; a cell move by its effective
 * date. A machine bought after the date is out (a machine with no purchase date is in: when it was added to the
 * system says nothing about when it stood on the floor). People and lists are as they are now.
 */
export function dataAsOf(data: EngineData, asOf: string): EngineData {
  const { timeZone } = data;
  const rewound = new Set<string>();
  const view = <T extends TicketRow>(ticket: T): T => {
    const seen = ticketAsOf(ticket, asOf, timeZone) as T;
    if (seen !== ticket) rewound.add(ticket.id);
    return seen;
  };
  const reported = (t: TicketRow) => plantDay(t.reportedAt, timeZone) <= asOf;
  const tickets = data.tickets.filter(reported).map(view);
  const tasks = data.tasks.filter(reported).map(view);
  /** The ticket rows in the cut: a report whose ticket is not here cannot be in a coherent snapshot. */
  const cut = new Set([...tickets, ...tasks].map((t) => t.id));
  return {
    ...data,
    machines: data.machines.filter((m) => m.purchasedOn === null || m.purchasedOn <= asOf),
    moves: data.moves.filter((m) => m.effectiveFrom <= asOf),
    tickets,
    tasks,
    reports: data.reports.filter(
      (r) =>
        r.date <= asOf &&
        (r.ticketId === null || (cut.has(r.ticketId) && !rewound.has(r.ticketId))),
    ),
  };
}
