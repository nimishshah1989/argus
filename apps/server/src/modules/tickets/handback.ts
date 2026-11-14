import type { PoolClient } from 'pg';
import { loginAdminById } from '../identity/index.js';
import { apiError } from '@uptimo/shared';
import type { Outcome, Tx } from './mapper.js';

/** The cell the machine was in when the ticket was reported; what the old machine row says now may have moved on. */
function cellAtReport(row: Record<string, unknown>): string | null {
  const snapshot = (row.machine_snapshot ?? {}) as { cell?: string | null };
  return snapshot.cell ?? null;
}

/** DOMAIN §3: an operator login whose cell is the cell the machine was reported in may answer for it. */
export async function loginInTicketCell(
  client: PoolClient,
  tx: Tx,
  row: Record<string, unknown>,
): Promise<boolean> {
  const cell = cellAtReport(row);
  if (!cell || tx.auth.role !== 'operator') return false;
  return (await loginAdminById(client, tx.auth.loginId))?.cell === cell;
}

/**
 * A dispute reopens this ticket, but the database allows one open ticket per machine. If someone has meanwhile
 * reported the machine again, say so plainly instead of answering "already reported" about a different ticket.
 */
export async function reopenConflict(
  client: PoolClient,
  tx: Tx,
  ticket: { id: string; kind: string; machineId: string | null },
): Promise<Outcome | null> {
  if (tx.action !== 'handback' || tx.body.response !== 'disputed') return null;
  if (ticket.kind === 'general' || !ticket.machineId) return null;
  const other = (
    await client.query(
      `SELECT ref FROM ticket
        WHERE tenant_id = $1 AND machine_id = $2 AND id <> $3 AND kind <> 'general'
          AND status NOT IN ('closed', 'cancelled')`,
      [tx.tenantId, ticket.machineId, ticket.id],
    )
  ).rows[0];
  if (!other) return null;
  return {
    status: 409,
    body: apiError(
      'conflict',
      `The sign-off cannot reopen this ticket: the machine already has an open ticket, ${other.ref as string}.`,
    ),
  };
}
