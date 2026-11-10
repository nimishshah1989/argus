import type { TicketEvent, WorkSegment } from './types.js';
import type { Ticket } from './ticket.js';
import * as commands from './state/commands.js';
import type { Command, TransitionInput, TransitionResult } from './state/types.js';

export * from './state/types.js';
export * from './state/helpers.js';
export * from './state/commands.js';

const handlers: {
  [K in Command['type']]: (
    input: TransitionInput,
    command: Extract<Command, { type: K }>,
  ) => TransitionResult;
} = {
  start: commands.start,
  pause: commands.pause,
  resume: commands.resume,
  transfer: commands.transfer,
  update: commands.update,
  machineRunning: commands.machineRunning,
  machineStopped: commands.machineStopped,
  close: commands.close,
  cancel: commands.cancel,
  join: commands.join,
  leave: commands.leave,
  upgradeKind: commands.upgradeKind,
  lateReport: commands.lateReport,
  restore: commands.restore,
  correct: commands.correct,
};

export function transition(input: TransitionInput): TransitionResult {
  const handler = handlers[input.command.type];
  return handler(input, input.command as never);
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

export interface PastBreakdownInput {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  machineId: string | null;
  problem: string;
  reportedAt: Date;
  closedAt: Date;
  raisedLoginId: string;
  reportedByPersonId: string | null;
  closedByPersonId: string | null;
}

export function recordPastBreakdown(input: PastBreakdownInput): {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
} {
  const ticket: Ticket = {
    id: input.id,
    ref: input.ref,
    kind: input.kind,
    status: 'closed',
    machineId: input.machineId,
    problem: input.problem,
    reportedAt: input.reportedAt,
    raisedLoginId: input.raisedLoginId,
    reportedByPersonId: input.reportedByPersonId,
    selfStarted: false,
    startedAt: input.reportedAt,
    leadPersonId: input.closedByPersonId,
    segmentStartedAt: input.reportedAt,
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
    closedAt: input.closedAt,
    closedByPersonId: input.closedByPersonId,
    closeKind: 'report',
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: 2,
    figures: null,
  };
  return {
    ticket,
    events: [
      { type: 'down', at: input.reportedAt },
      { type: 'close', at: input.closedAt },
    ],
    segments: input.closedByPersonId
      ? [
          {
            personId: input.closedByPersonId,
            role: 'lead' as const,
            startedAt: input.reportedAt,
            endedAt: input.closedAt,
          },
        ]
      : [],
  };
}
