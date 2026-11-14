import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { erasedNamesAmong } from '../identity/index.js';
import {
  emptyImportStats,
  ImportFatalError,
  markBatchFatal,
  openBatch,
  type ImportCtx,
} from './batch.js';
import { advanceRefCounters } from './counters.js';
import { loadBatchSnapshot } from './fingerprint-sql.js';
import { makeCompletionFingerprint } from './fingerprint.js';
import { importTicket } from './insert.js';
import { planRows, rowIssue, type PlannedRow } from './identity.js';
import { canonicalSha256 } from './json.js';
import { applyParentLinks, planParentGraph } from './parents.js';
import { ReconcileError } from './reconcile.js';
import {
  parseSyntheticExport,
  type AliasConfig,
  type ImportIssue,
  type ImportStats,
  type SyntheticExport,
} from './schema.js';
import { finishBatch, insertErrorRow, insertPendingRow, updateImportRow } from './repo.js';
import { lockRefCounter } from '../tickets/index.js';

export type AfterImport = (client: PoolClient, tenantId: string) => Promise<void>;
type TicketResult = Awaited<ReturnType<typeof importTicket>>;
type RunCtx = ImportCtx & { aliases: AliasConfig; now: Date; timeZone?: string };

function sourceRef(row: PlannedRow): string | null {
  if (row.ticket) return row.ticket.legacyId;
  if (typeof row.raw !== 'object' || row.raw === null || Array.isArray(row.raw)) return null;
  const legacy = (row.raw as Record<string, unknown>).legacyId;
  return typeof legacy === 'string' ? legacy : null;
}

function issueIdentity(row: PlannedRow) {
  return {
    rowNumber: row.rowNumber,
    legacyId: row.ticket?.legacyId ?? sourceRef(row),
    ref: row.ticket?.ref ?? null,
  };
}

function zodIssue(row: PlannedRow, error: z.ZodError): ImportIssue {
  const first = error.issues[0];
  return rowIssue(
    issueIdentity(row),
    'validation',
    first?.message ?? 'Ticket validation failed',
    first?.path.join('.') ?? null,
  );
}

function errorProperty(error: unknown, key: 'code' | 'constraint'): unknown {
  return typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

function genericIssue(row: PlannedRow, error: unknown): ImportIssue {
  const code = errorProperty(error, 'code');
  const constraint = errorProperty(error, 'constraint');
  const suffix = constraint ? ` (${String(constraint)})` : '';
  const message = error instanceof Error ? error.message : String(error);
  return rowIssue(
    issueIdentity(row),
    code ? String(code) : 'row_error',
    `${message}${suffix}`.slice(0, 1000),
  );
}

function errorIssues(row: PlannedRow, error: unknown): ImportIssue[] {
  if (error instanceof ReconcileError) {
    return error.issues.map((issue) => ({
      ...issue,
      rowNumber: row.rowNumber,
      legacyId: issue.legacyId ?? row.ticket?.legacyId ?? null,
      ref: issue.ref ?? row.ticket?.ref ?? null,
    }));
  }
  return [error instanceof z.ZodError ? zodIssue(row, error) : genericIssue(row, error)];
}

function failRow(stats: ImportStats, row: PlannedRow, issues: ImportIssue[]): void {
  row.outcome = 'error';
  stats.errored += 1;
  stats.issues.push(...issues);
}

/** A person this row created has the name of someone erased: the row still imports, and the report says to look. */
async function flagPossiblyErased(
  ctx: RunCtx,
  row: PlannedRow,
  stats: ImportStats,
  result: TicketResult,
): Promise<void> {
  if ((await erasedNamesAmong(ctx.client, ctx.tenantId, result.pendingPersons)).size === 0) return;
  stats.possiblyErasedMatches += 1;
  result.issues.push(
    rowIssue(
      issueIdentity(row),
      'possible_erased_match',
      'A person created by this row may be one who was erased: check before using them',
    ),
  );
}

function succeedRow(stats: ImportStats, row: PlannedRow, result?: TicketResult): void {
  if (row.outcome === 'skip') {
    stats.skipped += 1;
    return;
  }
  if (!result) throw new Error('Imported row has no result');
  stats.imported += 1;
  stats.events += result.events;
  stats.crew += result.crew;
  stats.segments += result.segments;
  stats.reports += result.reports;
  stats.reportPeople += result.reportPeople;
  stats.exactMatches += result.exactMatches;
  stats.toleratedMismatches += result.toleratedMismatches;
  stats.overridesApplied += result.issues.filter(
    (issue) => issue.code === 'override_applied',
  ).length;
  stats.issues.push(...result.issues.map((issue) => ({ ...issue, rowNumber: row.rowNumber })));
  stats.pendingPersons = [...new Set([...stats.pendingPersons, ...result.pendingPersons])];
}

function markParentFailed(plans: PlannedRow[], parent: PlannedRow): void {
  const queue = [parent.rowNumber];
  const seen = new Set<number>();
  while (queue.length) {
    const number = queue.shift() as number;
    for (const row of plans) {
      if (row.parentRowNumber !== number || seen.has(row.rowNumber)) continue;
      seen.add(row.rowNumber);
      if (row.outcome !== 'error') {
        row.outcome = 'error';
        row.issues.push(
          rowIssue(issueIdentity(row), 'parent_unavailable', `Parent row ${number} failed`),
        );
      }
      queue.push(row.rowNumber);
    }
  }
}

async function updateRow(
  ctx: ImportCtx,
  batchId: string,
  input: {
    rowId: string;
    status: 'imported' | 'skipped' | 'error';
    ticketId?: string;
    error?: string;
  },
): Promise<void> {
  await updateImportRow(ctx.client, { ...input, tenantId: ctx.tenantId, batchId });
}

async function insertRaw(ctx: ImportCtx, batchId: string, row: PlannedRow): Promise<string> {
  return insertPendingRow(ctx.client, {
    tenantId: ctx.tenantId,
    batchId,
    rowNumber: row.rowNumber,
    sourceRef: sourceRef(row),
    payload: row.erasedBefore ? '{}' : JSON.stringify(row.envelope),
  });
}

async function rawFailure(ctx: ImportCtx, batchId: string, row: PlannedRow): Promise<void> {
  await ctx.client.query('ROLLBACK TO SAVEPOINT import_raw');
  await insertErrorRow(ctx.client, {
    tenantId: ctx.tenantId,
    batchId,
    rowNumber: row.rowNumber,
    sourceRef: sourceRef(row),
    payload: JSON.stringify({ format: 'argus.import-error/v1', rawSha256: row.envelope.rawSha256 }),
  });
  await ctx.client.query('RELEASE SAVEPOINT import_raw');
}

async function runRow(
  ctx: RunCtx,
  batchId: string,
  row: PlannedRow,
  stats: ImportStats,
): Promise<void> {
  await ctx.client.query('SAVEPOINT import_raw');
  let rowId: string;
  try {
    rowId = await insertRaw(ctx, batchId, row);
  } catch {
    await rawFailure(ctx, batchId, row);
    failRow(stats, row, [
      rowIssue(issueIdentity(row), 'raw_insert_failed', 'Unable to persist raw import row'),
    ]);
    return;
  }
  await ctx.client.query('SAVEPOINT import_ticket');
  try {
    if (row.outcome === 'error') throw new ReconcileError(row.issues);
    if (row.outcome === 'skip') {
      if (!row.existingTicketId) throw new Error('Skipped row has no ticket');
      await updateRow(ctx, batchId, { rowId, status: 'skipped', ticketId: row.existingTicketId });
      succeedRow(stats, row);
    } else {
      const result = await importTicket(
        ctx.client,
        ctx.tenantId,
        row.ticket as NonNullable<PlannedRow['ticket']>,
        {
          aliases: ctx.aliases,
          now: ctx.now,
          timeZone: ctx.timeZone,
        },
      );
      row.existingTicketId = result.ticketId;
      await flagPossiblyErased(ctx, row, stats, result);
      await updateRow(ctx, batchId, { rowId, status: 'imported', ticketId: result.ticketId });
      succeedRow(stats, row, result);
    }
    await ctx.client.query('RELEASE SAVEPOINT import_ticket');
    await ctx.client.query('RELEASE SAVEPOINT import_raw');
  } catch (error) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT import_ticket');
    const issues = errorIssues(row, error);
    await updateRow(ctx, batchId, {
      rowId,
      status: 'error',
      error: issues[0]?.message ?? 'Row failed',
    });
    await ctx.client.query('RELEASE SAVEPOINT import_ticket');
    await ctx.client.query('RELEASE SAVEPOINT import_raw');
    failRow(stats, row, issues);
  }
}

function resolveRuntimeDuplicate(row: PlannedRow, plans: PlannedRow[]): boolean {
  if (!row.duplicateOf) return true;
  const first = plans.find((candidate) => candidate.rowNumber === row.duplicateOf);
  if (!first || first.outcome === 'error') {
    row.outcome = 'error';
    row.issues.push(
      rowIssue(
        issueIdentity(row),
        'duplicate_of_failed_row',
        `Duplicate of failed row ${row.duplicateOf}`,
      ),
    );
    return true;
  }
  row.outcome = 'skip';
  row.existingTicketId = first.existingTicketId;
  return true;
}

async function runMain(
  pool: Pool,
  tenantId: string,
  batchId: string,
  input: {
    parsed: SyntheticExport;
    aliasSha256: string;
    now: Date;
    timeZone?: string;
    afterImport?: AfterImport;
  },
): Promise<{ batchId: string; stats: ImportStats }> {
  const { parsed, aliasSha256, now, timeZone, afterImport } = input;
  const context = { aliasSha256, now, timeZone };
  return withTenant(pool, tenantId, async (client) => {
    const ctx: RunCtx = {
      client,
      tenantId,
      aliases: parsed.aliases,
      now: context.now,
      timeZone: context.timeZone,
    };
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bhavin-import:${tenantId}`]);
    await lockRefCounter(client, tenantId, 'BD');
    await lockRefCounter(client, tenantId, 'WR');
    const plans = await planParentGraph(ctx, await planRows(ctx, parsed.tickets, parsed.aliases));
    const stats = emptyImportStats(parsed.tickets.length, context.aliasSha256);
    for (const row of plans) {
      const before = stats.errored;
      if (resolveRuntimeDuplicate(row, plans)) await runRow(ctx, batchId, row, stats);
      if (stats.errored > before && row.outcome === 'error') markParentFailed(plans, row);
    }
    stats.parentRepairs = await applyParentLinks(ctx, plans);
    stats.refCounters = await advanceRefCounters(ctx, plans);
    // The caller decides what follows (the CLI reconciles SLA timers); this module reaches no other.
    await afterImport?.(client, tenantId);
    stats.completion = makeCompletionFingerprint(
      await loadBatchSnapshot(client, tenantId, batchId, false),
    );
    stats.pendingPeople = stats.pendingPersons.length;
    stats.hardMismatches = stats.issues.filter(
      (issue) => issue.code.startsWith('figure_') && issue.severity === 'error',
    ).length;
    stats.status = stats.errored === 0 && stats.hardMismatches === 0 ? 'done' : 'failed';
    await finishBatch(client, {
      status: stats.status,
      stats: JSON.stringify(stats),
      batchId,
      tenantId,
    });
    return { batchId, stats };
  });
}

export async function importBhavin(
  pool: Pool,
  tenantId: string,
  input: unknown,
  options: { timeZone?: string; afterImport?: AfterImport } = {},
): Promise<{ batchId: string; stats: ImportStats }> {
  const parsed = parseSyntheticExport(input);
  const now = new Date();
  const aliasSha256 = canonicalSha256(parsed.aliases);
  const batchId = await openBatch(pool, tenantId, {
    ticketCount: parsed.tickets.length,
    aliasSha256,
    now,
  });
  try {
    return await runMain(pool, tenantId, batchId, { parsed, aliasSha256, now, ...options });
  } catch (error) {
    try {
      await markBatchFatal(pool, tenantId, batchId, {
        ticketCount: parsed.tickets.length,
        aliasSha256,
        error,
      });
    } catch (fatalError) {
      throw new AggregateError(
        [error, fatalError],
        `Import batch ${batchId} failed and fatal status could not be saved`,
        { cause: fatalError },
      );
    }
    throw new ImportFatalError(batchId, error);
  }
}

export { undoImport } from './undo.js';
