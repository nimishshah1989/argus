import type { PoolClient } from 'pg';
import * as shared from '@uptimo/shared';
import type { Outcome, Tx } from './mapper.js';
import { personExists } from './repo/ticket.js';

const FIELD_OF: Record<string, string> = { transfer: 'toPersonId', pause: 'assignToPersonId' };

/** A transfer or a pause may hand the ticket only to a person who is on; else 422 naming the field. */
export async function checkHandoverTarget(client: PoolClient, tx: Tx): Promise<Outcome | null> {
  const field = FIELD_OF[tx.action];
  const target = field ? (tx.body[field] as string | undefined) : undefined;
  if (!field || !target || (await personExists(client, tx.tenantId, target))) return null;
  return {
    status: 422,
    body: shared.apiError('validation', 'That person is switched off or unknown', field),
  };
}
