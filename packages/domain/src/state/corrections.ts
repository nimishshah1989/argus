import type {
  Criticality,
  EditChange,
  RestorableStatus,
  SeverityMatrix,
  TicketEvent,
  WorkSegment,
} from '../types.js';
import type { Ticket } from '../ticket.js';
import { canCorrect } from '../permissions.js';
import { deriveSeverity } from '../severity.js';
import { apply, clampAt, TransitionError } from './helpers.js';
import type { Command, TransitionInput, TransitionResult } from './types.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface PastBreakdownInput {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  machineId: string | null;
  machineCriticality?: Criticality | null;
  severityMatrix?: SeverityMatrix;
  slaPolicyId?: string | null;
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
    slaPolicyId: input.slaPolicyId ?? null,
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

export function restore(
  input: TransitionInput,
  command: Extract<Command, { type: 'restore' }>,
): TransitionResult {
  if (input.ticket.status !== 'cancelled')
    throw new TransitionError('Only a cancelled ticket can be restored');
  const cancel = [...input.events].reverse().find((event) => event.type === 'cancel');
  if (cancel && input.ctx.now.getTime() - cancel.at.getTime() > SEVEN_DAYS_MS) {
    throw new TransitionError('Can only restore within 7 days');
  }
  const toStatus: RestorableStatus = cancel?.status ?? command.toStatus ?? 'open';
  const at = clampAt(input.ctx.now, input);
  const lead = input.ticket.leadPersonId;
  const segments =
    toStatus === 'working' && lead
      ? [...input.segments, { personId: lead, role: 'lead' as const, startedAt: at }]
      : input.segments;
  return apply(input, {
    ticket: {
      status: toStatus,
      segmentStartedAt: at,
      waitSince: toStatus === 'waiting' ? at : null,
      cancelledAt: undefined,
    },
    event: { type: 'restore', reason: command.reason },
    at,
    segments,
  });
}

interface CorrectResult {
  edits: EditChange[];
  patch: Partial<Ticket>;
}

function recordEdit<K extends keyof Ticket>(
  result: CorrectResult,
  ticket: Ticket,
  field: K,
  value: Ticket[K] | undefined,
): void {
  if (value === undefined) return;
  result.edits.push({ field, from: ticket[field], to: value });
  result.patch[field] = value;
}

function assertCorrectionTimeline(ticket: Ticket, at: Date): void {
  if ([ticket.reportedAt, ticket.startedAt, ticket.closedAt].some((value) => value && value > at)) {
    throw new TransitionError('Correction times cannot be in the future');
  }
  if (ticket.startedAt && ticket.startedAt < ticket.reportedAt)
    throw new TransitionError('Start time cannot precede the report time');
  if (ticket.closedAt && ticket.closedAt < ticket.reportedAt)
    throw new TransitionError('Closed time cannot precede the report time');
  if (ticket.startedAt && ticket.closedAt && ticket.closedAt < ticket.startedAt)
    throw new TransitionError('Closed time cannot precede the start time');
}

export function correct(
  input: TransitionInput,
  command: Extract<Command, { type: 'correct' }>,
): TransitionResult {
  if (
    !canCorrect({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  )
    throw new TransitionError('Not allowed');
  if (input.ticket.status === 'cancelled')
    throw new TransitionError('Cannot correct a cancelled ticket');
  if (
    input.ticket.status === 'closed' &&
    input.ticket.closedAt &&
    input.ctx.now.getTime() - input.ticket.closedAt.getTime() > SEVEN_DAYS_MS
  )
    throw new TransitionError('Can only correct within 7 days of close');

  const result: CorrectResult = { edits: [], patch: {} };
  const changes = command.changes;
  recordEdit(result, input.ticket, 'reportedAt', changes.reportedAt);
  recordEdit(result, input.ticket, 'startedAt', changes.startedAt);
  recordEdit(result, input.ticket, 'closedAt', changes.closedAt);
  recordEdit(result, input.ticket, 'problem', changes.problem);
  recordEdit(result, input.ticket, 'machineId', changes.machineId);
  recordEdit(result, input.ticket, 'kind', changes.kind);
  recordEdit(result, input.ticket, 'leadPersonId', changes.leadPersonId);
  recordEdit(result, input.ticket, 'closedByPersonId', changes.closedByPersonId);
  for (const field of ['handsOnOverrideMin', 'waitingOverrideMin'] as const) {
    const value = changes[field];
    if (value !== undefined) {
      result.edits.push({ field, from: null, to: value });
    }
  }

  const merged: Ticket = { ...input.ticket, ...result.patch };
  const at = clampAt(input.ctx.now, input);
  assertCorrectionTimeline(merged, at);

  return apply(input, {
    ticket: result.patch,
    event: { type: 'edit', reason: command.reason, changes: result.edits },
    at,
    segments: input.segments,
  });
}
