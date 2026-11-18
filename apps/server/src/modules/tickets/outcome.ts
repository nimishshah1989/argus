import type { Pool, PoolClient } from 'pg';
import * as shared from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import * as idem from './repo/idempotency.js';
import * as report from './repo/report.js';
import type { Outcome } from './mapper.js';

export const ALREADY_OPEN: Outcome = {
  status: 409,
  body: shared.apiError('conflict', 'Already reported', 'machineId'),
};

/** Runs one command in the plant's transaction and turns the database's own refusals into replies. */
export async function runOutcome(
  pool: Pool,
  binding: idem.IdempotencyBinding,
  run: (client: PoolClient) => Promise<Outcome>,
): Promise<Outcome> {
  try {
    return await withTenant(pool, binding.tenantId, run);
  } catch (error) {
    if (error instanceof report.ReportValidationError) {
      return { status: 422, body: shared.apiError('validation', error.message, error.field) };
    }
    if (error instanceof idem.IdempotencyKeyReusedError) return idem.reusedKeyOutcome();
    if (!idem.isUniqueViolation(error)) throw error;
    const stored = await withTenant(pool, binding.tenantId, (client) =>
      idem.getIdempotent(client, binding),
    );
    if (stored) return stored;
    // The database's own one-open-breakdown-per-machine rule: the same answer as the duplicate check.
    if ((error as { constraint?: string }).constraint === 'ticket_open_breakdown_unique') {
      return ALREADY_OPEN;
    }
    return { status: 500, body: shared.apiError('internal', 'Internal error') };
  }
}
