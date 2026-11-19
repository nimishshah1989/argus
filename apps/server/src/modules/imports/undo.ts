import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import {
  fingerprintMismatches,
  makeCompletionFingerprint,
  type BatchSnapshot,
} from './fingerprint.js';
import { removeImported } from '../tickets/index.js';
import { erasedRowCount, lockBatchRow } from './repo.js';
import { loadBatchSnapshot } from './fingerprint-sql.js';
import { REAL_SOURCE } from './bhavin-export.js';
import { canonicalSha256, SYNTHETIC_SOURCE } from './json.js';
import { channelOfEntry, type CompletionFingerprint } from './schema.js';

interface LockedBatch {
  stats: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function validTicket(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.ticketId === 'string' &&
    typeof value.legacyId === 'string' &&
    value.legacyId.length > 0 &&
    (value.entryType === 'ordinary' ||
      value.entryType === 'pastBreakdown' ||
      value.entryType === 'pastUtility') &&
    validDigest(value.digest)
  );
}

function assertCanonical(completion: CompletionFingerprint): void {
  const ids = completion.tickets.map((ticket) => ticket.ticketId);
  const sorted = [...ids].sort();
  if (ids.some((id, index) => id !== sorted[index]) || new Set(ids).size !== ids.length) {
    throw new Error('Undo refused: completion fingerprint tickets are not canonical');
  }
  const digest = canonicalSha256({ version: 1, tickets: completion.tickets });
  if (digest !== completion.digest) {
    throw new Error('Undo refused: completion fingerprint digest is invalid');
  }
}

function parseCompletion(value: unknown): CompletionFingerprint {
  if (!isRecord(value) || value.version !== 1 || value.algorithm !== 'sha256') {
    throw new Error('Undo refused: version-1 completion fingerprint is required');
  }
  if (!validDigest(value.digest) || !Array.isArray(value.tickets)) {
    throw new Error('Undo refused: completion fingerprint is invalid');
  }
  if (!value.tickets.every(validTicket)) {
    throw new Error('Undo refused: completion fingerprint ticket is invalid');
  }
  const completion = value as unknown as CompletionFingerprint;
  assertCanonical(completion);
  return completion;
}

async function lockBatch(
  client: PoolClient,
  tenantId: string,
  batchId: string,
): Promise<LockedBatch> {
  const batch = await lockBatchRow(client, tenantId, batchId);
  if (!batch) throw new Error('Import batch not found');
  if (
    !isRecord(batch.stats) ||
    (batch.stats.contract !== SYNTHETIC_SOURCE && batch.stats.contract !== REAL_SOURCE)
  ) {
    throw new Error('Undo refused: synthetic import contract is required');
  }
  if (batch.status !== 'done' && batch.status !== 'failed') {
    throw new Error(`Undo refused: batch status ${batch.status} is not undoable`);
  }
  return { stats: batch.stats };
}

function assertProvenance(expected: CompletionFingerprint, actual: BatchSnapshot): void {
  const currentById = new Map(actual.tickets.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of expected.tickets) {
    const current = currentById.get(ticket.ticketId);
    if (!current) continue;
    if (current.legacyId !== ticket.legacyId || current.entryType !== ticket.entryType) {
      throw new Error(`Undo refused: imported-row provenance mismatch for ${ticket.legacyId}`);
    }
    const channel = channelOfEntry(ticket.entryType);
    if (current.ticket.raised_channel !== channel) {
      throw new Error(`Undo refused: raised channel mismatch for ${ticket.legacyId}`);
    }
  }
}

function assertCompletion(expected: CompletionFingerprint, actual: BatchSnapshot): void {
  assertProvenance(expected, actual);
  const current = makeCompletionFingerprint(actual);
  const mismatches = fingerprintMismatches(expected, current);
  if (mismatches.length) {
    throw new Error(`Undo refused: completion fingerprint mismatch: ${mismatches.join('; ')}`);
  }
}

/**
 * Erasing a person rewrites their name inside the tickets themselves (the one permitted edit of history), so the
 * batch no longer matches the fingerprint taken when it finished. Say that, instead of a bare digest mismatch.
 */
async function explainErasure(
  client: PoolClient,
  batch: { tenantId: string; batchId: string },
  error: unknown,
): Promise<Error | null> {
  if (!(error instanceof Error) || !error.message.includes('fingerprint mismatch')) return null;
  if ((await erasedRowCount(client, batch.tenantId, batch.batchId)) === 0) return null;
  return new Error(
    'Undo refused: a person was erased from this batch (erasing a person rewrites names inside its tickets), ' +
      'so it can no longer be matched to what was imported. Nothing was deleted.',
  );
}

/** `router` connects as a member of app_router and app_user (ROUTER_DATABASE_URL). */
export async function undoImport(
  router: Pool,
  tenantId: string,
  batchId: string,
  operator: string,
): Promise<{ deleted: number }> {
  return withTenant(router, tenantId, async (client) => {
    // The checks run with exactly the app's rights; only the deletes run as the definer function.
    await client.query('SET LOCAL ROLE app_user');
    const batch = await lockBatch(client, tenantId, batchId);
    const completion = parseCompletion((batch.stats as { completion?: unknown }).completion);
    const snapshot = await loadBatchSnapshot(client, tenantId, batchId, true);
    try {
      assertCompletion(completion, snapshot);
    } catch (error) {
      throw (await explainErasure(client, { tenantId, batchId }, error)) ?? error;
    }
    await client.query('RESET ROLE');
    return { deleted: await removeImported(client, { tenantId, batchId, operator }) };
  });
}
