import type { FigureOverrides, TicketEvent } from '@uptimo/domain';
import { normalizeCode } from './json.js';
import type { BhavinEvent } from './event-schema.js';
import type { BhavinState, BhavinTicket } from './schema.js';
import { applyImportedEvent, type MutableImportedState } from './state-events.js';

export interface ReducedTicket {
  ticket: BhavinTicket;
  state: BhavinState;
  kind: 'stopped' | 'support' | 'general';
  machineCode: string | null;
  problem: string;
  reportedAt: Date;
  overrides: FigureOverrides;
  domainEvents: TicketEvent[];
  editedAt: Date | null;
  lastEventSeq: number;
}

const STATE_KEYS = [
  'selfStarted',
  'startedAt',
  'segmentStartedAt',
  'leadPerson',
  'handedOver',
  'handoverSince',
  'transferToPerson',
  'transferToShift',
  'transfers',
  'waitReason',
  'waitSince',
  'pausedByPerson',
  'assignedToPerson',
  'expectedBackAt',
  'waitingSpare',
  'machineRunningAt',
  'machineStoppedAt',
  'kindUpgradedAt',
  'closedAt',
  'closedByPerson',
  'closeKind',
  'closeNote',
  'cancelledAt',
] as const satisfies ReadonlyArray<keyof BhavinState>;

function firstEditFrom(ticket: BhavinTicket, field: string): unknown {
  for (const event of ticket.events) {
    if (event.type !== 'edit') continue;
    const change = event.payload.changes.find((item) => item.field === field);
    if (change) return change.from;
  }
  return undefined;
}

function initialState(ticket: BhavinTicket, down: BhavinEvent): MutableImportedState {
  const upgraded = ticket.events.some((event) => event.type === 'upgrade_kind');
  return {
    status: 'open',
    kind: (upgraded
      ? 'support'
      : (firstEditFrom(ticket, 'kind') ?? ticket.kind)) as BhavinTicket['kind'],
    machineCode: (firstEditFrom(ticket, 'machineCode') ?? ticket.machineCode) as string | null,
    problem: (firstEditFrom(ticket, 'problem') ?? ticket.problem) as string,
    reportedAt: down.at,
    overrides: {},
    editedAt: null,
    selfStarted: false,
    startedAt: null,
    segmentStartedAt: null,
    leadPerson: null,
    handedOver: false,
    handoverSince: null,
    transferToPerson: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    pausedByPerson: null,
    assignedToPerson: null,
    expectedBackAt: null,
    waitingSpare: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    kindUpgradedAt: null,
    closedAt: null,
    closedByPerson: null,
    closeKind: null,
    closeNote: null,
    cancelledAt: null,
  };
}

function validateEventTimes(ticket: BhavinTicket, now: Date): void {
  let previous: Date | null = null;
  ticket.events.forEach((event, seq) => {
    if (previous && event.at.getTime() < previous.getTime()) {
      throw new Error(`event_order at seq ${seq}`);
    }
    if (event.at.getTime() > now.getTime()) throw new Error(`future_event at seq ${seq}`);
    previous = event.at;
  });
}

function assertNotFuture(value: Date | null, field: string, now: Date): void {
  if (value && value.getTime() > now.getTime()) throw new Error(`future_business_time ${field}`);
}

function validateBusinessTimes(ticket: BhavinTicket, now: Date): void {
  assertNotFuture(ticket.reportedAt, 'reportedAt', now);
  for (const key of STATE_KEYS) {
    if (key === 'expectedBackAt') continue;
    const value = ticket.state[key];
    if (value instanceof Date) assertNotFuture(value, `state.${key}`, now);
  }
  for (const [index, member] of ticket.crew.entries()) {
    assertNotFuture(member.joinedAt, `crew[${index}].joinedAt`, now);
    assertNotFuture(member.leftAt, `crew[${index}].leftAt`, now);
  }
  for (const [index, segment] of ticket.segments.entries()) {
    assertNotFuture(segment.startedAt, `segments[${index}].startedAt`, now);
    assertNotFuture(segment.endedAt, `segments[${index}].endedAt`, now);
  }
  for (const [index, report] of ticket.reports.entries()) {
    assertNotFuture(report.submittedAt, `reports[${index}].submittedAt`, now);
  }
  for (const event of ticket.events) {
    if (event.type !== 'edit') continue;
    for (const change of event.payload.changes) {
      if (change.from instanceof Date)
        assertNotFuture(change.from, `edit.${change.field}.from`, now);
      if (change.to instanceof Date) assertNotFuture(change.to, `edit.${change.field}.to`, now);
    }
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  return Object.is(left, right);
}

function validateSuppliedState(ticket: BhavinTicket, state: MutableImportedState): void {
  const last = ticket.events.length - 1;
  if (state.status !== ticket.status) throw new Error(`state_mismatch status at seq ${last}`);
  if (state.kind !== ticket.kind) throw new Error(`state_mismatch kind at seq ${last}`);
  if (state.machineCode !== ticket.machineCode) {
    throw new Error(`state_mismatch machineCode at seq ${last}`);
  }
  if (state.problem !== ticket.problem) throw new Error(`state_mismatch problem at seq ${last}`);
  if (!sameValue(state.reportedAt, ticket.reportedAt)) {
    throw new Error(`state_mismatch reportedAt at seq ${last}`);
  }
  for (const key of STATE_KEYS) {
    if (!sameValue(state[key], ticket.state[key])) {
      throw new Error(`state_mismatch ${key} at seq ${last}`);
    }
  }
}

/** A plant event: raise, one `utility_loss` line per machine, close; nobody works on it. */
function validatePlantEvent(ticket: BhavinTicket): void {
  const last = ticket.events.length - 1;
  const lines = ticket.events.slice(1, last);
  const valid = [
    ticket.events[0]?.type === 'down',
    ticket.events[last]?.type === 'close',
    lines.length > 0,
    lines.every((event) => event.type === 'utility_loss'),
    // one line per machine: a repeated machine would count its minutes twice
    new Set(
      lines.map((event) =>
        event.type === 'utility_loss' ? normalizeCode(event.payload.machineCode) : '',
      ),
    ).size === lines.length,
    ticket.status === 'closed',
    ticket.state.closeKind === 'done',
    ticket.crew.length === 0,
    ticket.segments.length === 0,
    !ticket.state.selfStarted,
  ];
  if (valid.some((condition) => !condition)) throw new Error('past_utility_shape');
}

function validatePast(ticket: BhavinTicket): void {
  if (ticket.entryType === 'pastUtility') return validatePlantEvent(ticket);
  if (ticket.events.some((event) => event.type === 'utility_loss')) {
    throw new Error('utility_loss_requires_plant_event');
  }
  if (ticket.entryType !== 'pastBreakdown') return;
  const valid = [
    ticket.events.length === 2,
    ticket.events[0]?.type === 'down',
    ticket.events[1]?.type === 'close',
    ticket.status === 'closed',
    ticket.state.closeKind === 'report',
    ticket.reports.length === 1,
    ticket.crew.length === 0,
    ticket.segments.length === 0,
    !ticket.state.selfStarted,
  ];
  if (valid.some((condition) => !condition)) throw new Error('past_breakdown_shape at seq 1');
}

function validateReportShape(state: MutableImportedState, ticket: BhavinTicket): void {
  if (state.status === 'closed' && state.closeKind === 'report') {
    if (ticket.reports.length !== 1) throw new Error('report_required');
    return;
  }
  if (ticket.reports.length !== 0) throw new Error('report_not_allowed');
}

function validateFinalTimes(ticket: BhavinTicket, state: MutableImportedState): void {
  const firstStart = ticket.events.find(
    (event) => event.type === 'start' || event.type === 'pickup',
  );
  if (firstStart && state.reportedAt.getTime() > firstStart.at.getTime()) {
    throw new Error('reported_after_start');
  }
  if (state.startedAt && state.closedAt && state.startedAt > state.closedAt) {
    throw new Error('closed_before_start');
  }
  const closeIndex = ticket.events.findIndex((event) => event.type === 'close');
  const latest = ticket.events
    .slice(0, closeIndex < 0 ? 0 : closeIndex + 1)
    .filter((event) => event.type !== 'edit')
    .at(-1)?.at;
  if (state.closedAt && latest && state.closedAt < latest) throw new Error('closed_before_event');
}

function publicState(state: MutableImportedState): BhavinState {
  return Object.fromEntries(STATE_KEYS.map((key) => [key, state[key]])) as unknown as BhavinState;
}

export function reduceTicketState(ticket: BhavinTicket, now: Date): ReducedTicket {
  validatePast(ticket);
  if (
    ticket.events[0]?.type !== 'down' ||
    ticket.events.filter((e) => e.type === 'down').length !== 1
  ) {
    throw new Error('ordinary_down_required at seq 0');
  }
  validateEventTimes(ticket, now);
  validateBusinessTimes(ticket, now);
  const state = initialState(ticket, ticket.events[0]);
  Object.assign(state, {
    _firstStart: null,
    _previousStatus: null,
    _crew: ticket.crew,
    _segments: ticket.segments,
    _reports: ticket.reports,
    _past: ticket.entryType !== 'ordinary',
    _plant: ticket.entryType === 'pastUtility',
  });
  // A `utility_loss` line is history only: it changes no state and the figures never see it.
  const domainEvents = ticket.events
    .map((event, seq) => applyImportedEvent(state, event, seq))
    .filter((_, seq) => ticket.events[seq]?.type !== 'utility_loss');
  validateSuppliedState(ticket, state);
  validateFinalTimes(ticket, state);
  validateReportShape(state, ticket);
  return {
    ticket,
    state: publicState(state),
    kind: state.kind,
    machineCode: state.machineCode,
    problem: state.problem,
    reportedAt: state.reportedAt,
    overrides: state.overrides,
    domainEvents,
    editedAt: state.editedAt,
    lastEventSeq: ticket.events.length - 1,
  };
}
