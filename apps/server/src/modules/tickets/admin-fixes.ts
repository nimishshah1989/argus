import type { PoolClient } from 'pg';
import type { Ticket, TicketEvent } from '@uptimo/domain';
import * as shared from '@uptimo/shared';
import { audit } from '../ops/index.js';
import { machinesByIds } from '../plant/index.js';
import type { LoadedCtx, Outcome, Tx } from './mapper.js';
import { figuresFromRow } from './mapper.js';

/** A correction naming a machine that is not in this plant is "not found", not a database error. */
export async function unknownCorrectedMachine(client: PoolClient, tx: Tx): Promise<Outcome | null> {
  const machineId = (tx.body.changes as { machineId?: string | null } | undefined)?.machineId;
  if (tx.action !== 'correct' || !machineId) return null;
  const found = (await machinesByIds(client, tx.tenantId, [machineId], 'share'))[0];
  return found
    ? null
    : { status: 404, body: shared.apiError('not_found', 'Unknown machine', 'changes.machineId') };
}

/** Minutes set directly by a correction: kept on the ticket so every later recompute applies them. */
export function overridesFrom(tx: Tx, current: Record<string, unknown>): Record<string, unknown> {
  if (tx.action !== 'correct') return current;
  const changes = tx.body.changes as { activeMin?: number; waitMin?: number };
  return {
    ...current,
    ...(changes.activeMin === undefined ? {} : { handsOnOverrideMin: changes.activeMin }),
    ...(changes.waitMin === undefined ? {} : { waitingOverrideMin: changes.waitMin }),
  };
}

/** The domain does not know the minutes a direct set replaces; the stored figures do. */
export function fillReplacedMinutes(loaded: LoadedCtx, events: TicketEvent[]): void {
  const stored = figuresFromRow(loaded.row);
  const last = events[events.length - 1];
  for (const change of last?.changes ?? []) {
    if (change.field === 'handsOnOverrideMin') change.from = stored.activeMin;
    if (change.field === 'waitingOverrideMin') change.from = stored.waitMin;
  }
}

/** Cancel, restore and correct each leave their old and new values with the reason in the audit trail. */
export async function recordAdminFix(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
  result: { ticket: Ticket; events: TicketEvent[] },
): Promise<void> {
  if (!['cancel', 'restore', 'correct'].includes(tx.action)) return;
  const reason = tx.body.reason as string;
  const base = {
    tenantId: tx.tenantId,
    loginId: tx.auth.loginId,
    entity: 'ticket',
    entityId: tx.ticketId,
  };
  if (tx.action === 'correct') {
    const changes = result.events[result.events.length - 1]?.changes ?? [];
    await audit.record(client, {
      ...base,
      action: 'ticket.correct',
      before: Object.fromEntries(changes.map((c) => [c.field, c.from ?? null])),
      after: { ...Object.fromEntries(changes.map((c) => [c.field, c.to ?? null])), reason },
    });
    return;
  }
  await audit.record(client, {
    ...base,
    action: `ticket.${tx.action}`,
    before: { status: loaded.ticket.status },
    after: { status: result.ticket.status, reason },
  });
}
