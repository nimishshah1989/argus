import type { PoolClient } from 'pg';
import { apiError, type Lockout } from '@uptimo/shared';
import { standingLockoutConfirmation } from '@uptimo/domain';
import { lockoutFlagged, lockoutSteps } from '../plant/index.js';
import type { Outcome, Tx } from './mapper.js';
import { lockoutHistory, openTicketWorkType, reportCategory } from './repo/lockout.js';

/**
 * What a ticket's reply says about lockout: `null` unless the ticket is open and needs one. It needs one when its
 * work type, or the breakdown category of its stored report, is flagged "needs lockout". The flag is read each
 * time (Start, the reply), so one set after the ticket was raised counts.
 */
export async function lockoutOf(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<Lockout | null> {
  const ticket = await openTicketWorkType(client, tenantId, ticketId);
  if (!ticket) return null;
  const flagged = new Map((await lockoutFlagged(client, tenantId)).map((f) => [f.list, f.names]));
  const category = await reportCategory(client, tenantId, ticketId);
  const needed =
    (ticket.workType != null && flagged.get('work_type')?.includes(ticket.workType)) ||
    (category != null && flagged.get('breakdown_category')?.includes(category));
  if (!needed) return null;
  const standing = standingLockoutConfirmation(await lockoutHistory(client, ticketId));
  return {
    steps: await lockoutSteps(client, tenantId),
    confirmed: standing
      ? { at: standing.at.toISOString(), byPersonId: standing.actingPersonId }
      : null,
  };
}

/**
 * The two lockout rules the commands need the plant's lists for. Start is refused until the steps are confirmed.
 * Confirming needs every active step named, and the texts are kept on the history entry as they were worded then.
 * Runs inside the command's transaction; `null` lets the command go on.
 */
export async function checkLockout(client: PoolClient, tx: Tx): Promise<Outcome | null> {
  if (tx.action !== 'start' && tx.action !== 'lockout-confirm') return null;
  const state = await lockoutOf(client, tx.tenantId, tx.ticketId);
  if (tx.action === 'start') {
    return state && !state.confirmed
      ? {
          status: 409,
          body: apiError(
            'lockout_required',
            'Confirm the lockout steps before starting this ticket',
            'lockout',
          ),
        }
      : null;
  }
  // Not open: the ordinary rules answer. Open and not flagged: there is nothing to confirm.
  const open = await openTicketWorkType(client, tx.tenantId, tx.ticketId);
  if (!open) return null;
  if (!state) return { status: 409, body: apiError('conflict', 'This ticket needs no lockout') };
  const sent = new Set(tx.body.stepCodes as string[]);
  if (sent.size !== state.steps.length || !state.steps.every((s) => sent.has(s.code))) {
    return { status: 422, body: apiError('validation', 'Confirm every lockout step', 'stepCodes') };
  }
  tx.body.steps = state.steps.map((s) => s.label);
  return null;
}
