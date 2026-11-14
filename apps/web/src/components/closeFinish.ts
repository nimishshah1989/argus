import { figures, type TicketEvent as DomainEvent } from '@uptimo/domain';
import type { TicketDetail } from '../api.js';

/** Start and close times move in 5-minute steps (design lock, slice 2). */
export const STEP_MIN = 5;
const MINUTE = 60_000;

/** A finish time moved by `deltaMin`, never before `floor` (the last event) or after `ceiling` (now). */
export function stepFinish(finish: Date, deltaMin: number, floor: Date, ceiling: Date): Date {
  const moved = finish.getTime() + deltaMin * MINUTE;
  return new Date(Math.min(Math.max(moved, floor.getTime()), ceiling.getTime()));
}

/** The latest time on the ticket's log: the earliest a close can be dated (the domain's `lastEventAt`). */
export function earliestFinish(detail: TicketDetail): Date {
  const times = [detail.ticket.reportedAt, ...detail.events.map((event) => event.at)];
  return new Date(Math.max(...times.map((time) => Date.parse(time))));
}

export interface FinishFigures {
  responseMin: number | null;
  repairMin: number;
  downtimeMin: number | null;
}

/** The figures the ticket would have if it closed at `finish`, by the domain's own rules. */
export function finishFigures(detail: TicketDetail, finish: Date): FinishFigures {
  const { ticket } = detail;
  const result = figures({
    reportedAt: new Date(ticket.reportedAt),
    kind: ticket.kind,
    kindUpgradedAt: ticket.kindUpgradedAt ? new Date(ticket.kindUpgradedAt) : undefined,
    selfStarted: ticket.selfStarted,
    events: detail.events.map((event): DomainEvent => ({
      type: event.type as DomainEvent['type'],
      at: new Date(event.at),
      isVendor: event.isVendor,
    })),
    segments: detail.intervals.map((interval) => ({
      personId: interval.personId,
      role: interval.role as 'lead' | 'primary' | 'support',
      startedAt: new Date(interval.startedAt),
      endedAt: interval.endedAt ? new Date(interval.endedAt) : finish,
    })),
    now: finish,
    closedAt: finish,
  });
  return {
    responseMin: result.responseMin,
    repairMin: result.repairMin,
    downtimeMin: result.downtimeMin,
  };
}
