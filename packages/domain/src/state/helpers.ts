import type { TicketEvent, WorkSegment } from '../types.js';
import type { Ticket } from '../ticket.js';
import type { TransitionInput, TransitionResult } from './types.js';

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function lastEventAt(input: TransitionInput): Date {
  const last = input.events[input.events.length - 1];
  return last ? last.at : input.ticket.reportedAt;
}

export function clampAt(at: Date, input: TransitionInput): Date {
  const earliest = lastEventAt(input);
  const time = at.getTime() < earliest.getTime() ? earliest : at;
  return time.getTime() > input.ctx.now.getTime() ? input.ctx.now : time;
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
