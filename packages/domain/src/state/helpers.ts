import type { TicketEvent, WorkSegment } from '../types.js';
import { clampFrom } from './internal.js';
import type { Ticket } from '../ticket.js';
import type { TransitionInput, TransitionResult } from './types.js';

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

/** The latest time on the log (a back-dated start can sit before an earlier-written event). */
export function lastEventAt(input: TransitionInput): Date {
  return input.events.reduce(
    (latest, event) => (event.at.getTime() > latest.getTime() ? event.at : latest),
    input.ticket.reportedAt,
  );
}

export function clampAt(at: Date, input: TransitionInput): Date {
  return clampFrom(at, lastEventAt(input), input);
}

export function assertWorking(input: TransitionInput): void {
  if (input.ticket.status !== 'working') throw new TransitionError('Ticket is not being worked on');
}

export function closeSegments(segments: WorkSegment[], now: Date): WorkSegment[] {
  return segments.map((segment) => (segment.endedAt ? segment : { ...segment, endedAt: now }));
}

export function nextSeq(input: TransitionInput): number {
  return input.ticket.lastEventSeq + 1;
}

export interface ApplyChanges {
  ticket: Partial<Ticket>;
  event: Omit<TicketEvent, 'at'>;
  at: Date;
  segments: WorkSegment[];
  crew?: import('../types.js').CrewMember[];
}

export function apply(input: TransitionInput, changes: ApplyChanges): TransitionResult {
  const merged: Ticket = { ...input.ticket, ...changes.ticket, lastEventSeq: nextSeq(input) };
  return {
    ticket: merged,
    events: [...input.events, { ...changes.event, at: changes.at }],
    segments: changes.segments,
    crew: changes.crew ?? input.crew,
  };
}
