import type { PoolClient } from 'pg';
import { failureCodeIndex, type FailureCodeIndex } from '@uptimo/shared';
import { audit } from '../ops/index.js';
import { failureCodeSeedRows } from './failure-code-defaults.js';
import {
  failureCodes,
  hasFailureCodes,
  insertFailureCode,
  lockFailureCodeSeed,
  maintenanceCodes,
} from './repo/reads.js';

type Db = Pick<PoolClient, 'query'>;

/**
 * Gives a plant that has no failure codes yet the list it closes with: its own maintenance codes copied
 * (aliases folded), or the plant module's fallback 19 when it holds none — as ordinary rows the head edits on
 * the failure-code list. The `has…` check comes before the advisory lock, so an ordinary close or list read on
 * a seeded plant never serialises; a plant with any entry (a switched-off one counts) is left exactly as it is.
 * Safe to call again and from two places at once: the second caller takes its turn, re-checks, and seeds nothing.
 */
export async function ensureFailureCodes(
  tx: PoolClient,
  who: { tenantId: string; loginId: string | null },
): Promise<void> {
  if (await hasFailureCodes(tx, who.tenantId)) return;
  await lockFailureCodeSeed(tx, who.tenantId);
  if (await hasFailureCodes(tx, who.tenantId)) return;
  const rows = failureCodeSeedRows(await maintenanceCodes(tx, who.tenantId));
  for (const row of rows) await insertFailureCode(tx, who.tenantId, row);
  await audit.record(tx, {
    tenantId: who.tenantId,
    loginId: who.loginId,
    action: 'failure_code.seed',
    entity: 'list_item',
    before: null,
    after: { codes: rows.length },
  });
}

/** The plant's list as the map a code or an alias resolves through (a switched-off code stays in it). */
export async function failureCodeIndexOf(tx: Db, tenantId: string): Promise<FailureCodeIndex> {
  return failureCodeIndex(await failureCodes(tx, tenantId));
}
