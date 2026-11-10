import type { ActorContext, TicketEvent, WorkSegment } from './types.js';
import type { Ticket } from './ticket.js';
import { canCancel, canClose, canWork } from './permissions.js';

export type Command =
  | { type: 'start'; personId: string; at?: Date; pickup?: boolean }
  | { type: 'pause'; personId: string; reason: string; note?: string; assignToPersonId?: string }
  | { type: 'resume'; personId: string; note?: string }
  | { type: 'transfer'; personId: string; toPersonId?: string; toShift?: string; note: string }
  | { type: 'update'; personId: string; text: string }
  | { type: 'machineRunning'; personId: string; at?: Date }
  | { type: 'machineStopped'; personId: string }
  | {
      type: 'close';
      personId: string;
      kind: 'report' | 'no_report' | 'done';
      at?: Date;
      note?: string;
    }
  | { type: 'cancel'; personId: string; reason: string };

export interface TransitionInput {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
  command: Command;
  ctx: ActorContext & { now: Date };
}

export interface TransitionResult {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

function lastEventAt(input: TransitionInput): Date {
  const last = input.events[input.events.length - 1];
  return last ? last.at : input.ticket.reportedAt;
}

function clampAt(at: Date, input: TransitionInput): Date {
  const earliest = lastEventAt(input);
  const time = at.getTime() < earliest.getTime() ? earliest : at;
  return time.getTime() > input.ctx.now.getTime() ? input.ctx.now : time;
}

function assertWorking(input: TransitionInput): void {
  if (input.ticket.status !== 'working') throw new TransitionError('Ticket is not being worked on');
}

function closeSegments(segments: WorkSegment[], now: Date): WorkSegment[] {
  return segments.map((segment) => (segment.endedAt ? segment : { ...segment, endedAt: now }));
}

function nextSeq(input: TransitionInput): number {
  return input.ticket.lastEventSeq + 1;
}

interface ApplyChanges {
  ticket: Partial<Ticket>;
  event: Omit<TicketEvent, 'at'>;
  at: Date;
  segments: WorkSegment[];
}

function apply(input: TransitionInput, changes: ApplyChanges): TransitionResult {
  const merged: Ticket = { ...input.ticket, ...changes.ticket, lastEventSeq: nextSeq(input) };
  return {
    ticket: merged,
    events: [...input.events, { ...changes.event, at: changes.at }],
    segments: changes.segments,
  };
}

export function transition(input: TransitionInput): TransitionResult {
  const { command } = input;
  switch (command.type) {
    case 'start':
      return start(input, command);
    case 'pause':
      return pause(input, command);
    case 'resume':
      return resume(input, command);
    case 'transfer':
      return transfer(input, command);
    case 'update':
      return update(input, command);
    case 'machineRunning':
      return machineRunning(input, command);
    case 'machineStopped':
      return machineStopped(input, command);
    case 'close':
      return close(input, command);
    case 'cancel':
      return cancel(input, command);
  }
}

function start(
  input: TransitionInput,
  command: Extract<Command, { type: 'start' }>,
): TransitionResult {
  if (input.ticket.status !== 'open') throw new TransitionError('Can only start an open ticket');
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  ) {
    throw new TransitionError('Not allowed');
  }
  const at = clampAt(command.at ?? input.ctx.now, input);
  const ticket = {
    status: 'working' as const,
    startedAt: at,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    handedOver: false,
  };
  const event = {
    type: command.pickup ? ('pickup' as const) : ('start' as const),
    reason: undefined,
  };
  const segment: WorkSegment = { personId: command.personId, role: 'lead' as const, startedAt: at };
  return apply(input, { ticket, event, at, segments: [...input.segments, segment] });
}

function pause(
  input: TransitionInput,
  command: Extract<Command, { type: 'pause' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'waiting' as const,
    waitReason: command.reason,
    waitSince: at,
    assignedToPersonId: command.assignToPersonId ?? input.ticket.assignedToPersonId,
  };
  return apply(input, {
    ticket,
    event: { type: 'pause' as const, reason: command.reason },
    at,
    segments: closeSegments(input.segments, at),
  });
}

function resume(
  input: TransitionInput,
  command: Extract<Command, { type: 'resume' }>,
): TransitionResult {
  if (input.ticket.status !== 'waiting')
    throw new TransitionError('Can only resume a waiting ticket');
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'working' as const,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    waitReason: null,
    waitSince: null,
  };
  const segment: WorkSegment = { personId: command.personId, role: 'lead' as const, startedAt: at };
  return apply(input, {
    ticket,
    event: { type: 'resume' as const },
    at,
    segments: [...input.segments, segment],
  });
}

function transfer(
  input: TransitionInput,
  command: Extract<Command, { type: 'transfer' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'open' as const,
    handedOver: true,
    handoverSince: at,
    transferToPersonId: command.toPersonId ?? null,
    transferToShift: command.toShift ?? null,
    transfers: input.ticket.transfers + 1,
    leadPersonId: null,
    segmentStartedAt: null,
  };
  return apply(input, {
    ticket,
    event: { type: 'transfer' as const, reason: command.note },
    at,
    segments: closeSegments(input.segments, at),
  });
}

function update(
  input: TransitionInput,
  command: Extract<Command, { type: 'update' }>,
): TransitionResult {
  if (!['open', 'working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Cannot update a closed ticket');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: {},
    event: { type: 'update' as const, reason: command.text },
    at,
    segments: input.segments,
  });
}

function machineRunning(
  input: TransitionInput,
  command: Extract<Command, { type: 'machineRunning' }>,
): TransitionResult {
  if (input.ticket.kind !== 'stopped')
    throw new TransitionError('Only a stopped ticket has a running machine');
  const at = clampAt(command.at ?? input.ctx.now, input);
  return apply(input, {
    ticket: { machineRunningAt: at, machineStoppedAt: null },
    event: { type: 'running' as const },
    at,
    segments: input.segments,
  });
}

function machineStopped(
  input: TransitionInput,
  _command: Extract<Command, { type: 'machineStopped' }>,
): TransitionResult {
  if (!input.ticket.machineRunningAt) throw new TransitionError('Machine is not running');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { machineStoppedAt: at },
    event: { type: 'stopped' as const },
    at,
    segments: input.segments,
  });
}

function close(
  input: TransitionInput,
  command: Extract<Command, { type: 'close' }>,
): TransitionResult {
  assertWorking(input);
  if (
    !canClose(
      {
        role: input.ctx.role,
        loginId: input.ctx.loginId,
        personId: input.ctx.personId,
        shared: input.ctx.shared,
      },
      {
        raisedLoginId: input.ticket.raisedLoginId,
        leadPersonId: input.ticket.leadPersonId,
        startedAt: input.ticket.startedAt,
        status: input.ticket.status,
        crew: [],
      },
    )
  ) {
    throw new TransitionError('Not allowed to close');
  }
  const at = clampAt(command.at ?? input.ctx.now, input);
  const ticket = {
    status: 'closed' as const,
    closedAt: at,
    closedByPersonId: command.personId,
    closeKind: command.kind,
    closeNote: command.note ?? null,
  };
  return apply(input, {
    ticket,
    event: { type: 'close' as const, reason: command.note },
    at,
    segments: closeSegments(input.segments, at),
  });
}

function cancel(
  input: TransitionInput,
  command: Extract<Command, { type: 'cancel' }>,
): TransitionResult {
  const actor: ActorContext = {
    role: input.ctx.role,
    loginId: input.ctx.loginId,
    personId: input.ctx.personId,
    shared: input.ctx.shared,
  };
  if (
    !canCancel(actor, {
      raisedLoginId: input.ticket.raisedLoginId,
      leadPersonId: input.ticket.leadPersonId,
      startedAt: input.ticket.startedAt,
      status: input.ticket.status,
      crew: [],
    })
  ) {
    throw new TransitionError('Not allowed to cancel');
  }
  const at = clampAt(input.ctx.now, input);
  const ticket = { status: 'cancelled' as const };
  return apply(input, {
    ticket,
    event: { type: 'cancel' as const, reason: command.reason },
    at,
    segments: closeSegments(input.segments, at),
  });
}

export interface RaiseInput {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  machineId: string | null;
  problem: string;
  reportedAt: Date;
  raisedLoginId: string;
  reportedByPersonId: string | null;
  selfStarted: boolean;
  startNow: boolean;
  startByPersonId?: string;
}

export function raiseTicket(input: RaiseInput): {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
} {
  let seq = 0;
  const events: TicketEvent[] = [{ type: 'down', at: input.reportedAt }];
  const segments: WorkSegment[] = [];
  let startedAt: Date | null = null;
  let leadPersonId: string | null = null;
  let segmentStartedAt: Date | null = null;
  if (input.startNow) {
    const person = input.startByPersonId ?? input.reportedByPersonId;
    if (person) {
      seq += 1;
      events.push({ type: 'start', at: input.reportedAt });
      segments.push({ personId: person, role: 'lead', startedAt: input.reportedAt });
      startedAt = input.reportedAt;
      leadPersonId = person;
      segmentStartedAt = input.reportedAt;
    }
  }
  const ticket: Ticket = {
    id: input.id,
    ref: input.ref,
    kind: input.kind,
    status: 'open',
    machineId: input.machineId,
    problem: input.problem,
    reportedAt: input.reportedAt,
    raisedLoginId: input.raisedLoginId,
    reportedByPersonId: input.reportedByPersonId,
    selfStarted: input.selfStarted,
    startedAt,
    leadPersonId,
    segmentStartedAt,
    handedOver: false,
    handoverSince: null,
    transferToPersonId: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    assignedToPersonId: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    closedAt: null,
    closedByPersonId: null,
    closeKind: null,
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: seq,
    figures: null,
  };
  return { ticket, events, segments };
}
