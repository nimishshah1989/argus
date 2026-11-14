import type { PoolClient } from 'pg';
import * as shared from '@uptimo/shared';
import { actingRefusal, AUTH_MESSAGES } from '../../kernel/index.js';
import * as tm from './mapper.js';
import * as sql from './repo/ticket.js';

type Outcome = tm.Outcome;

/**
 * Who acts is always the session's person (a shared phone's chosen one), never one a request names; a correction
 * is the admin's own act. The read is locked, so a switch-off that is under way finishes first: a person already
 * off is no longer signed in.
 */
export async function resolveActingPerson(
  client: PoolClient,
  tx: tm.Tx,
): Promise<{ personId: string | null } | Outcome> {
  if (tx.action === 'correct') return { personId: tx.auth.personId };
  const refused = actingRefusal(tx.auth, tx.body.personId as string | undefined, 'personId');
  if (refused) return refused;
  if (!(await sql.personExists(client, tx.tenantId, tx.auth.personId!))) {
    return { status: 401, body: shared.apiError('unauthenticated', AUTH_MESSAGES.ended) };
  }
  return { personId: tx.auth.personId };
}
