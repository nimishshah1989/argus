import type { PoolClient } from 'pg';
import { loginAdminById } from '../identity/index.js';
import type { Tx } from './mapper.js';

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
