import type { PoolClient } from 'pg';
import { apiError } from '@uptimo/shared';
import type { Outcome, Tx } from './mapper.js';
import { openTicketOn } from './repo/list.js';

/** The cell the machine was in when the ticket was reported; what the old machine row says now may have moved on. */
function cellAtReport(row: Record<string, unknown>): string | null {
  const snapshot = (row.machine_snapshot ?? {}) as { cell?: string | null };
  return snapshot.cell ?? null;
}

/** DOMAIN §3: an operator login whose cell is the cell the machine was reported in may answer for it. */
export function loginInTicketCell(tx: Tx, row: Record<string, unknown>): boolean {
  const cell = cellAtReport(row);
  return cell !== null && tx.auth.role === 'operator' && tx.auth.cell === cell;
}

/**
 * A sign-off refused to an operator, who answers only for their own cell, says which cell the machine was in and
 * which is theirs, so the app can tell them where to go. Any other refusal stays the plain one.
 */
export function otherCellRefusal(tx: Tx, row: Record<string, unknown>, refused: Outcome): Outcome {
  if (refused.status !== 403 || tx.action !== 'handback' || tx.auth.role !== 'operator') {
    return refused;
  }
  return {
    status: 403,
    body: apiError('other_cell', 'This machine is in another cell', undefined, {
      machineCell: cellAtReport(row),
      loginCell: tx.auth.cell,
    }),
  };
}

/**
 * A dispute reopens this ticket, but the database allows one open ticket per machine. If someone has meanwhile
 * reported the machine again, say so plainly instead of answering "already reported" about a different ticket.
 */
export async function reopenConflict(
  client: PoolClient,
  tx: Tx,
  ticket: { kind: string; machineId: string | null },
): Promise<Outcome | null> {
  if (tx.action !== 'handback' || tx.body.response !== 'disputed') return null;
  if (ticket.kind === 'general' || !ticket.machineId) return null;
  const other = await openTicketOn(client, tx.tenantId, ticket.machineId);
  if (!other) return null;
  return {
    status: 409,
    body: apiError(
      'reopen_blocked',
      `The sign-off cannot reopen this ticket: the machine already has an open ticket, ${other.ref}.`,
      undefined,
      {
        openTicket: {
          ticketId: other.id,
          ref: other.ref,
          reportedAt: other.reportedAt.toISOString(),
        },
      },
    ),
  };
}
