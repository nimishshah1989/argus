import type { PoolClient } from 'pg';
import type { Ticket, TicketEvent } from '@uptimo/domain';
import * as shared from '@uptimo/shared';
import { audit } from '../ops/index.js';
import { machinesByIds } from '../plant/index.js';
import type { LoadedCtx, Outcome, Tx } from './mapper.js';
import { figuresFromRow } from './mapper.js';
import { setMachineSnapshot } from './repo/overrides.js';
import { personExists } from './repo/ticket.js';

type Changes = {
  machineId?: string | null;
  leadPersonId?: string | null;
  closedByPersonId?: string | null;
  activeMin?: number | null;
  waitMin?: number | null;
};

const notFound = (message: string, field: string): Outcome => ({
  status: 404,
  body: shared.apiError('not_found', message, field),
});

/**
 * A correction may name a machine or people: each must exist in this plant (RLS scopes the lookups), else 404 and not a
 * database error. A corrected machine also replaces the machine details the ticket shows.
 */
export async function checkCorrectedRefs(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
): Promise<Outcome | null> {
  if (tx.action !== 'correct') return null;
  const changes = (tx.body.changes ?? {}) as Changes;
  for (const field of ['leadPersonId', 'closedByPersonId'] as const) {
    const id = changes[field];
    if (id && !(await personExists(client, tx.tenantId, id)))
      return notFound('Unknown person', `changes.${field}`);
  }
  if (!changes.machineId) return null;
  const machine = (await machinesByIds(client, tx.tenantId, [changes.machineId], 'share'))[0];
  if (!machine) return notFound('Unknown machine', 'changes.machineId');
  const { code, category, cell, criticality } = machine;
  loaded.extras.machineSnapshot = { code, category, cell, criticality };
  return null;
}

/** The ticket row keeps the machine details it shows; a corrected machine replaces them. */
export async function saveCorrectedMachine(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
): Promise<void> {
  const changes = (tx.body.changes ?? {}) as Changes;
  if (tx.action !== 'correct' || !changes.machineId) return;
  await setMachineSnapshot(client, tx.ticketId, loaded.extras.machineSnapshot);
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
