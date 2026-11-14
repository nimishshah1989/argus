import type { FigureInput, Ticket, TicketEvent, WorkSegment } from '@uptimo/domain';

/** What the domain's `figures` reads: a ticket's own fields with its events, segments and hand-set overrides. */
export function figureInput(
  ticket: Ticket,
  events: TicketEvent[],
  segments: WorkSegment[],
  opts: { overrides: Record<string, unknown>; now: Date },
): FigureInput {
  return {
    reportedAt: ticket.reportedAt,
    kind: ticket.kind,
    kindUpgradedAt: ticket.kindUpgradedAt ?? undefined,
    selfStarted: ticket.selfStarted,
    events,
    segments,
    overrides: opts.overrides,
    now: opts.now,
    closedAt: ticket.closedAt ?? undefined,
  };
}
