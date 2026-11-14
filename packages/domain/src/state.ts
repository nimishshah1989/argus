import type { Criticality, SeverityMatrix, TicketEvent, WorkSegment } from './types.js';
import type { Ticket } from './ticket.js';
import { handlers } from './state/commands/registry.js';
import { deriveSeverity } from './severity.js';
import type { TransitionInput, TransitionResult } from './state/types.js';

export * from './state/types.js';
export * from './state/helpers.js';
export * from './state/commands/index.js';
export * from './state/past-breakdown.js';

export function transition(input: TransitionInput): TransitionResult {
  const handler = handlers[input.command.type];
  return handler(input, input.command as never);
}

export interface RaiseInput {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  machineId: string | null;
  machineCriticality?: Criticality | null;
  severityMatrix?: SeverityMatrix;
  urgent?: boolean;
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
  const criticalitySnapshot = input.machineCriticality ?? null;
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
    severity: deriveSeverity(input),
    criticalitySnapshot,
    figures: null,
  };
  return { ticket, events, segments };
}
