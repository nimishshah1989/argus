import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import {
  fingerprintMismatches,
  makeCompletionFingerprint,
  type BatchSnapshot,
} from './fingerprint.js';
import { fileIdForTickets } from '../files/index.js';
import { audit } from '../ops/index.js';
import { deleteImportedTickets, outsideChildRef, reportWithFileId } from '../tickets/index.js';
import { lockBatchRow, markUndone } from './repo.js';
import { loadBatchSnapshot } from './fingerprint-sql.js';
import { canonicalSha256, SYNTHETIC_SOURCE } from './json.js';
import type { CompletionFingerprint } from './schema.js';

interface LockedBatch {
  tenantId: string;
  status: 'done' | 'failed';
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
    (value.entryType === 'ordinary' || value.entryType === 'pastBreakdown') &&
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
  if (!isRecord(batch.stats) || batch.stats.contract !== SYNTHETIC_SOURCE) {
    throw new Error('Undo refused: synthetic import contract is required');
  }
  if (batch.status !== 'done' && batch.status !== 'failed') {
    throw new Error(`Undo refused: batch status ${batch.status} is not undoable`);
  }
  return { tenantId, status: batch.status, stats: batch.stats };
}

function assertProvenance(expected: CompletionFingerprint, actual: BatchSnapshot): void {
  const currentById = new Map(actual.tickets.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of expected.tickets) {
    const current = currentById.get(ticket.ticketId);
    if (!current) continue;
    if (current.legacyId !== ticket.legacyId || current.entryType !== ticket.entryType) {
      throw new Error(`Undo refused: imported-row provenance mismatch for ${ticket.legacyId}`);
    }
    const channel = ticket.entryType === 'pastBreakdown' ? 'backfill' : 'import';
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

async function assertNoOutsideReferences(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<void> {
  if (!ticketIds.length) return;
  const childRef = await outsideChildRef(client, tenantId, ticketIds);
  if (childRef !== undefined) throw new Error(`Undo refused: outside child reference ${childRef}`);
  const fileId = await fileIdForTickets(client, tenantId, ticketIds);
  if (fileId) throw new Error(`Undo refused: ticket file reference ${fileId}`);
  const reportId = await reportWithFileId(client, tenantId, ticketIds);
  if (reportId !== undefined) throw new Error(`Undo refused: report file reference ${reportId}`);
}

async function deleteCandidates(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<void> {
  if (!ticketIds.length) return;
  const deleted = await deleteImportedTickets(client, tenantId, ticketIds);
  if (deleted !== ticketIds.length) {
    throw new Error('Undo refused: imported ticket delete count changed');
  }
}

async function finishUndo(
  client: PoolClient,
  batchId: string,
  batch: LockedBatch,
  completion: CompletionFingerprint,
): Promise<void> {
  const updated = await markUndone(client, batchId, batch.tenantId);
  if (updated !== 1) throw new Error('Undo refused: batch update failed');
  const before = {
    status: batch.status,
    fingerprintDigest: completion.digest,
    ticketIds: completion.tickets.map((ticket) => ticket.ticketId),
  };
  const after = { status: 'undone', deleted: completion.tickets.length };
  await audit.record(client, {
    tenantId: batch.tenantId,
    loginId: null,
    action: 'import.undo',
    entity: 'import_batch',
    entityId: batchId,
    before,
    after,
  });
}

export async function undoImport(
  pool: Pool,
  tenantId: string,
  batchId: string,
): Promise<{ deleted: number }> {
  return withTenant(pool, tenantId, async (client) => {
    const batch = await lockBatch(client, tenantId, batchId);
    const stats = batch.stats as { completion?: unknown };
    const completion = parseCompletion(stats.completion);
    const snapshot = await loadBatchSnapshot(client, tenantId, batchId, true);
    assertCompletion(completion, snapshot);
    const ticketIds = completion.tickets.map((ticket) => ticket.ticketId);
    await assertNoOutsideReferences(client, tenantId, ticketIds);
    await deleteCandidates(client, tenantId, ticketIds);
    await finishUndo(client, batchId, batch, completion);
    return { deleted: ticketIds.length };
  });
}
