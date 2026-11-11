import type { TicketEvent, WorkSegment } from './types.js';
import type { Ticket } from './ticket.js';
import * as commands from './state/commands.js';
import * as corrections from './state/corrections.js';
import type { Command, TransitionInput, TransitionResult } from './state/types.js';

export * from './state/types.js';
export * from './state/helpers.js';
export * from './state/commands.js';
export * from './state/corrections.js';

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
  restore: corrections.restore,
  correct: corrections.correct,
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
  const person = input.startNow ? (input.startByPersonId ?? input.reportedByPersonId) : null;
  let startedAt: Date | null = null;
  let leadPersonId: string | null = null;
  let segmentStartedAt: Date | null = null;
  if (person) {
    seq += 1;
    events.push({ type: 'start', at: input.reportedAt });
    segments.push({ personId: person, role: 'lead', startedAt: input.reportedAt });
    startedAt = input.reportedAt;
    leadPersonId = person;
    segmentStartedAt = input.reportedAt;
  }
  const ticket: Ticket = {
    id: input.id,
    ref: input.ref,
    kind: input.kind,
    status: person ? 'working' : 'open',
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
    severity: null,
    criticalitySnapshot: null,
    figures: null,
  };
  return { ticket, events, segments };
}
