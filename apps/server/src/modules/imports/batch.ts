import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import { emptyCompletionFingerprint } from './fingerprint.js';
import { SYNTHETIC_SOURCE } from './json.js';
import { failBatch, insertBatch } from './repo.js';
import { messageOf, type ImportStats } from './schema.js';

export interface ImportCtx {
  client: PoolClient;
  tenantId: string;
}

export function emptyImportStats(ticketCount: number, aliasSha256: string): ImportStats {
  return {
    contract: SYNTHETIC_SOURCE,
    status: 'done',
    tickets: ticketCount,
    imported: 0,
    skipped: 0,
    errored: 0,
    events: 0,
    crew: 0,
    segments: 0,
    reports: 0,
    reportPeople: 0,
    pendingPeople: 0,
    pendingPersons: [],
    exactMatches: 0,
    toleratedMismatches: 0,
    hardMismatches: 0,
    overridesApplied: 0,
    parentRepairs: [],
    issues: [],
    aliasSha256,
    refCounters: { BD: null, WR: null },
    fatal: null,
    completion: null,
  };
}

export async function openBatch(
  pool: Pool,
  tenantId: string,
  input: { ticketCount: number; aliasSha256: string; now: Date; contract?: string },
): Promise<string> {
  return withTenant(pool, tenantId, async (client) => {
    const stats = {
      contract: input.contract ?? SYNTHETIC_SOURCE,
      status: 'running',
      tickets: input.ticketCount,
      aliasSha256: input.aliasSha256,
    };
    return insertBatch(client, {
      tenantId,
      startedAt: input.now,
      stats: JSON.stringify(stats),
    });
  });
}

export async function markBatchFatal(
  pool: Pool,
  tenantId: string,
  batchId: string,
  input: { ticketCount: number; aliasSha256: string; error: unknown },
): Promise<ImportStats> {
  const stats = emptyImportStats(input.ticketCount, input.aliasSha256);
  Object.assign(stats, {
    status: 'failed',
    errored: input.ticketCount,
    fatal: { message: messageOf(input.error).slice(0, 1000) },
    completion: emptyCompletionFingerprint(),
  });
  await withTenant(pool, tenantId, async (client) => {
    const count = await failBatch(client, {
      stats: JSON.stringify(stats),
      batchId,
      tenantId,
    });
    if (count !== 1) throw new Error('Unable to persist fatal import batch status');
  });
  return stats;
}

export class ImportFatalError extends Error {
  readonly batchId: string;

  constructor(batchId: string, cause: unknown) {
    super(`Import batch ${batchId} failed fatally`, { cause });
    this.name = 'ImportFatalError';
    this.batchId = batchId;
  }
}
