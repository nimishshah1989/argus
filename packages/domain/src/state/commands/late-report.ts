import { apply, clampAt, TransitionError } from '../helpers.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function lateReport(
  input: TransitionInput,
  _command: Extract<Command, { type: 'lateReport' }>,
): TransitionResult {
  if (input.ticket.status !== 'closed' || input.ticket.closeKind !== 'no_report')
    throw new TransitionError('Only a closed no-report ticket takes a late report');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { closeKind: 'report' },
    event: { type: 'report' },
    at,
    segments: input.segments,
  });
}
