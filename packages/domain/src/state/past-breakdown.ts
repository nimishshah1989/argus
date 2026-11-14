import type { Criticality, SeverityMatrix, TicketEvent, WorkSegment } from '../types.js';
import type { Ticket } from '../ticket.js';
import { deriveSeverity } from '../severity.js';

export interface PastBreakdownInput {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  machineId: string | null;
  machineCriticality?: Criticality | null;
  severityMatrix?: SeverityMatrix;
  urgent?: boolean;
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
  const criticalitySnapshot = input.machineCriticality ?? null;
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
    startedAt: null,
    leadPersonId: null,
    segmentStartedAt: null,
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
    severity: deriveSeverity(input),
    criticalitySnapshot,
    figures: null,
  };
  return {
    ticket,
    events: [
      { type: 'down', at: input.reportedAt },
      { type: 'close', at: input.closedAt },
    ],
    segments: [],
  };
}
