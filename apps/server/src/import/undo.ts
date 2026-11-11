import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import {
  fingerprintMismatches,
  makeCompletionFingerprint,
  type BatchSnapshot,
} from './fingerprint.js';
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
  const result = await client.query(
    `SELECT status, stats FROM import_batch
     WHERE id = $1 AND tenant_id = $2 AND source = 'bhavin' FOR UPDATE`,
    [batchId, tenantId],
  );
  const batch = result.rows[0] as { status?: string; stats?: unknown } | undefined;
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
  const child = await client.query(
    `SELECT ref FROM ticket WHERE tenant_id = $1 AND parent_id = ANY($2::uuid[])
       AND id <> ALL($2::uuid[]) LIMIT 1`,
    [tenantId, ticketIds],
  );
  if (child.rows[0]) throw new Error(`Undo refused: outside child reference ${child.rows[0].ref}`);
  const file = await client.query(
    'SELECT id FROM file WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) LIMIT 1',
    [tenantId, ticketIds],
  );
  if (file.rows[0]) throw new Error(`Undo refused: ticket file reference ${file.rows[0].id}`);
  const report = await client.query(
    `SELECT id FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])
       AND (signature_file_id IS NOT NULL OR pdf_file_id IS NOT NULL) LIMIT 1`,
    [tenantId, ticketIds],
  );
  if (report.rows[0]) throw new Error(`Undo refused: report file reference ${report.rows[0].id}`);
}

async function deleteCandidates(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<void> {
  if (!ticketIds.length) return;
  await client.query(
    'DELETE FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])',
    [tenantId, ticketIds],
  );
  const deleted = await client.query(
    'DELETE FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
    [tenantId, ticketIds],
  );
  if (deleted.rowCount !== ticketIds.length) {
    throw new Error('Undo refused: imported ticket delete count changed');
  }
}

async function finishUndo(
  client: PoolClient,
  batchId: string,
  batch: LockedBatch,
  completion: CompletionFingerprint,
): Promise<void> {
  const updated = await client.query(
    "UPDATE import_batch SET status = 'undone' WHERE id = $1 AND tenant_id = $2 AND source = 'bhavin'",
    [batchId, batch.tenantId],
  );
  if (updated.rowCount !== 1) throw new Error('Undo refused: batch update failed');
  const before = {
    status: batch.status,
    fingerprintDigest: completion.digest,
    ticketIds: completion.tickets.map((ticket) => ticket.ticketId),
  };
  const after = { status: 'undone', deleted: completion.tickets.length };
  await client.query(
    `INSERT INTO audit_log (tenant_id, login_id, action, entity, entity_id, ip, before, after)
     VALUES ($1, NULL, 'import.undo', 'import_batch', $2, NULL, $3, $4)`,
    [batch.tenantId, batchId, JSON.stringify(before), JSON.stringify(after)],
  );
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
