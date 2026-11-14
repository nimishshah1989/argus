import type { RestorableStatus } from '../../types.js';
import { apply, clampAt, TransitionError } from '../helpers.js';
import { SEVEN_DAYS_MS } from '../limits.js';
import type { Command, TransitionInput, TransitionResult } from '../types.js';

export function restore(
  input: TransitionInput,
  command: Extract<Command, { type: 'restore' }>,
): TransitionResult {
  if (input.ticket.status !== 'cancelled')
    throw new TransitionError('Only a cancelled ticket can be restored');
  const cancel = [...input.events].reverse().find((event) => event.type === 'cancel');
  const cancelledAt = cancel?.at ?? input.ticket.cancelledAt;
  if (cancelledAt && input.ctx.now.getTime() - cancelledAt.getTime() > SEVEN_DAYS_MS) {
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
