import type { WorkSegment } from '@uptimo/domain';
import { normalizeKey } from './json.js';
import type { BhavinCrew, BhavinSegment, BhavinTicket } from './schema.js';
import type { ReducedTicket } from './state.js';

export interface ReconciledCrewMember {
  personId: string;
  role: 'primary' | 'support';
  joinedAt: Date;
  leftAt: Date | null;
  leftReason: string | null;
}

interface CheckedSegment extends WorkSegment {
  sourcePerson: string;
  endReason: BhavinSegment['endReason'];
}

interface Stretch {
  startedAt: Date;
  endedAt: Date | null;
}

function personId(name: string, people: ReadonlyMap<string, string>): string {
  const id = people.get(normalizeKey(name));
  if (!id) throw new Error(`unknown_person ${name}`);
  return id;
}

function mapCrew(crew: BhavinCrew[], people: ReadonlyMap<string, string>): ReconciledCrewMember[] {
  return crew.map((member) => ({
    personId: personId(member.person, people),
    role: member.role === 'lead' ? 'primary' : member.role,
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
    leftReason: member.leftReason,
  }));
}

function mapSegments(
  segments: BhavinSegment[],
  people: ReadonlyMap<string, string>,
): CheckedSegment[] {
  return segments
    .map((segment, index) => ({
      personId: personId(segment.person, people),
      role: segment.role,
      startedAt: segment.startedAt,
      ...(segment.endedAt === null ? {} : { endedAt: segment.endedAt }),
      sourcePerson: segment.person,
      endReason: segment.endReason,
      index,
    }))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.index - b.index);
}

function validateSamePerson(segments: CheckedSegment[], status: BhavinTicket['status']): void {
  const previous = new Map<string, CheckedSegment>();
  for (const segment of segments) {
    if (segment.endedAt && segment.endedAt.getTime() <= segment.startedAt.getTime()) {
      throw new Error(`invalid_segment_length ${segment.sourcePerson}`);
    }
    if (!segment.endedAt && status !== 'working') throw new Error('open segment outside working');
    const prior = previous.get(segment.personId);
    if (prior) {
      if (!prior.endedAt) throw new Error(`multiple open segments for ${segment.sourcePerson}`);
      if (segment.startedAt < prior.endedAt) {
        throw new Error(`same_person_overlap ${segment.sourcePerson}`);
      }
    }
    previous.set(segment.personId, segment);
  }
}

const STRETCH_STARTS = new Set(['start', 'pickup', 'resume']);
const STRETCH_ENDS = new Set(['pause', 'transfer', 'close', 'cancel']);

function workingStretches(ticket: BhavinTicket): Stretch[] {
  const stretches: Stretch[] = [];
  let current: Stretch | null = null;
  let cancelledFrom: 'open' | 'working' | 'waiting' | null = null;
  for (const event of ticket.events) {
    const restoredWork = event.type === 'restore' && cancelledFrom === 'working';
    if ((STRETCH_STARTS.has(event.type) || restoredWork) && current === null) {
      current = { startedAt: event.at, endedAt: null };
      stretches.push(current);
    }
    if (event.type === 'cancel') cancelledFrom = event.payload.previousStatus;
    if (event.type === 'restore' && !restoredWork) current = null;
    if (STRETCH_ENDS.has(event.type) && current) {
      current.endedAt = event.at;
      current = null;
    }
  }
  return stretches;
}

function validateStretch(segment: CheckedSegment, stretches: Stretch[]): void {
  const end = segment.endedAt;
  const match = end
    ? stretches.some(
        (stretch) =>
          segment.startedAt >= stretch.startedAt &&
          end >= stretch.startedAt &&
          (stretch.endedAt === null || end <= stretch.endedAt),
      )
    : stretches.some(
        (stretch) => stretch.endedAt === null && segment.startedAt >= stretch.startedAt,
      );
  if (!match) throw new Error(`segment_outside_working ${segment.sourcePerson}`);
}

function validateEndReason(ticket: BhavinTicket, segment: CheckedSegment): void {
  if (!segment.endedAt || !segment.endReason) return;
  const match = ticket.events.some(
    (event) =>
      event.type === segment.endReason &&
      event.at.getTime() === segment.endedAt?.getTime() &&
      (event.type !== 'leave' || event.by === segment.sourcePerson),
  );
  if (!match) throw new Error(`segment_end_reason ${segment.sourcePerson}`);
}

function validateCrewJoin(ticket: BhavinTicket, member: BhavinCrew, reduced: ReducedTicket): void {
  const match = ticket.events.some((event) => {
    if (event.at.getTime() !== member.joinedAt.getTime()) return false;
    if (event.type === 'join')
      return event.by === member.person && event.payload.role === member.role;
    if (!['start', 'pickup', 'resume', 'restore'].includes(event.type)) return false;
    if (member.role === 'support') return false;
    return (
      event.by === member.person ||
      (event.type === 'restore' && reduced.state.leadPerson === member.person)
    );
  });
  if (!match) throw new Error(`crew_join_event ${member.person}`);
}

function validateCrew(ticket: BhavinTicket, reduced: ReducedTicket): void {
  for (const member of ticket.crew) {
    validateCrewJoin(ticket, member, reduced);
    if (member.leftAt === null) continue;
    const match = ticket.events.some(
      (event) =>
        event.type === 'leave' &&
        event.by === member.person &&
        event.at.getTime() === member.leftAt?.getTime() &&
        event.text === member.leftReason,
    );
    if (!match) throw new Error(`crew_leave_event ${member.person}`);
  }
}

function validateOpenCrew(
  segments: CheckedSegment[],
  crew: ReconciledCrewMember[],
  reduced: ReducedTicket,
  people: ReadonlyMap<string, string>,
): void {
  const lead = reduced.state.leadPerson ? personId(reduced.state.leadPerson, people) : null;
  const lastResume =
    [...reduced.ticket.events].reverse().find((event) => event.type === 'resume')?.at ?? null;
  for (const segment of segments) {
    if (segment.endedAt || segment.personId === lead) continue;
    const acted = crew.some(
      (member) =>
        member.personId === segment.personId &&
        (lastResume === null || member.joinedAt >= lastResume),
    );
    if (!acted) throw new Error(`open segment outside active crew ${segment.sourcePerson}`);
  }
}

export function validateIntervals(
  ticket: BhavinTicket,
  reduced: ReducedTicket,
  people: ReadonlyMap<string, string>,
): { crew: ReconciledCrewMember[]; segments: WorkSegment[] } {
  const crew = mapCrew(ticket.crew, people);
  const checked = mapSegments(ticket.segments, people);
  validateSamePerson(checked, ticket.status);
  const stretches = workingStretches(ticket);
  for (const segment of checked) {
    validateStretch(segment, stretches);
    validateEndReason(ticket, segment);
  }
  validateCrew(ticket, reduced);
  validateOpenCrew(checked, crew, reduced, people);
  return {
    crew,
    segments: checked.map(({ sourcePerson: _sourcePerson, endReason: _endReason, ...segment }) => ({
      personId: segment.personId,
      role: segment.role,
      startedAt: segment.startedAt,
      ...(segment.endedAt ? { endedAt: segment.endedAt } : {}),
    })),
  };
}
