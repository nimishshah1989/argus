import type { EditChange } from '../../types.js';
import type { Ticket } from '../../ticket.js';
import { canCorrect } from '../../permissions.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import { SEVEN_DAYS_MS } from '../limits.js';
import type { Command, CorrectChanges, TransitionInput, TransitionResult } from '../types.js';

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
    throw new TransitionError('Invalid correction: times cannot be in the future');
  }
  if (ticket.startedAt && ticket.startedAt < ticket.reportedAt)
    throw new TransitionError('Invalid correction: the start cannot precede the report time');
  if (ticket.closedAt && ticket.closedAt < ticket.reportedAt)
    throw new TransitionError('Invalid correction: the close cannot precede the report time');
  if (ticket.startedAt && ticket.closedAt && ticket.closedAt < ticket.startedAt)
    throw new TransitionError('Invalid correction: the close cannot precede the start time');
}

const INVALID = (reason: string) => new TransitionError(`Invalid correction: ${reason}`);
// events that are not work: a close, a late report, an earlier correction, a cancel or restore, an escalation notice
const NOT_WORK = new Set([
  'close',
  'report',
  'edit',
  'cancel',
  'restore',
  'tag_add',
  'tag_remove',
  'escalate',
  'escalation_ack',
]);

/** The time the close was written (insert-only history), not the editable closedAt, so a correction cannot renew the window. */
function closeEventAt(input: TransitionInput): Date | null {
  const close = [...input.events].reverse().find((event) => event.type === 'close');
  return close?.at ?? input.ticket.closedAt;
}

/** Corrected times must agree with the ticket's own work: events and segments are history and are not rewritten. */
function assertAgreesWithHistory(
  input: TransitionInput,
  merged: Ticket,
  closeAt: Date | null,
): void {
  const times = (list: Date[]) => list.map((at) => at.getTime());
  const starts = times(
    input.events.filter((e) => e.type === 'start' || e.type === 'pickup').map((e) => e.at),
  );
  const firstWork = Math.min(...starts, ...times(input.segments.map((s) => s.startedAt)));
  if (Number.isFinite(firstWork)) {
    if (merged.startedAt && merged.startedAt.getTime() > firstWork)
      throw INVALID('the start is after the first work recorded on the ticket');
    if (merged.reportedAt.getTime() > firstWork)
      throw INVALID('the report is after the first work recorded on the ticket');
  }
  if (!merged.closedAt) return;
  const lastWork = Math.max(
    ...times(input.events.filter((e) => !NOT_WORK.has(e.type)).map((e) => e.at)),
    ...times(input.segments.flatMap((s) => (s.endedAt ? [s.endedAt] : []))),
  );
  if (Number.isFinite(lastWork) && merged.closedAt.getTime() < lastWork)
    throw INVALID('the close is before the last work recorded on the ticket');
  if (closeAt && merged.closedAt.getTime() > closeAt.getTime())
    throw INVALID('the close cannot be later than the time it was recorded');
}

/** Which tickets a correction may touch, and which fields only a closed ticket has. */
function assertCorrectable(
  input: TransitionInput,
  changes: CorrectChanges,
  closeAt: Date | null,
): void {
  const { status } = input.ticket;
  if (status === 'cancelled') throw new TransitionError('Cannot correct a cancelled ticket');
  if (status === 'closed' && closeAt && input.ctx.now.getTime() - closeAt.getTime() > SEVEN_DAYS_MS)
    throw new TransitionError('Can only correct within 7 days of close');
  if (changes.closedAt && status !== 'closed')
    throw new TransitionError('Only a closed ticket has a closing time to correct');
  const byHand =
    changes.handsOnOverrideMin !== undefined || changes.waitingOverrideMin !== undefined;
  if (byHand && status !== 'closed')
    throw new TransitionError('Minutes can be set by hand only on a closed ticket');
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
  const changes = command.changes;
  const closeAt = closeEventAt(input);
  assertCorrectable(input, changes, closeAt);

  const result: CorrectResult = { edits: [], patch: {} };
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
      result.edits.push({ field, from: null, to: value }); // null takes the override off again
    }
  }

  const merged: Ticket = { ...input.ticket, ...result.patch };
  if (merged.kind !== 'general' && !merged.machineId)
    throw new TransitionError('A breakdown or support request needs a machine');
  const at = clampAt(input.ctx.now, input);
  assertCorrectionTimeline(merged, at);
  assertAgreesWithHistory(input, merged, closeAt);

  return apply(input, {
    ticket: result.patch,
    event: { type: 'edit', reason: command.reason, changes: result.edits },
    at,
    segments: input.segments,
  });
}
