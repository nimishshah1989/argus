import type { EditChange } from '../../types.js';
import type { Ticket } from '../../ticket.js';
import { canCorrect } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import { SEVEN_DAYS_MS } from '../limits.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

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
  if (merged.kind !== 'general' && !merged.machineId)
    throw new TransitionError('A breakdown or support request needs a machine');
  const at = clampAt(input.ctx.now, input);
  assertCorrectionTimeline(merged, at);

  return apply(input, {
    ticket: result.patch,
    event: { type: 'edit', reason: command.reason, changes: result.edits },
    at,
    segments: input.segments,
  });
}
