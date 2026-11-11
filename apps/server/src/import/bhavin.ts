import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';
import { importTicket } from './insert.js';
import {
  bhavinExportSchema,
  messageOf,
  orNull,
  parseTicket,
  type BhavinExport,
  type ImportCtx,
  type ImportStats,
  type ImportedRow,
  type Progress,
  type RowInput,
} from './schema.js';

function emptyStats(count: number): ImportStats {
  return { tickets: count, imported: 0, skipped: 0, errored: 0, events: 0, crew: 0, segments: 0 };
}

async function openBatch(ctx: ImportCtx): Promise<string> {
  const row = (
    await ctx.client.query(
      "INSERT INTO import_batch (tenant_id, source, status, started_at) VALUES ($1, 'bhavin', 'running', now()) RETURNING id",
      [ctx.tenantId],
    )
  ).rows[0] as { id: string };
  return row.id;
}

async function insertRow(ctx: ImportCtx, row: RowInput): Promise<string> {
  const sourceRef = (row.raw as { ref?: string }).ref ?? null;
  const result = (
    await ctx.client.query(
      "INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload) VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id",
      [ctx.tenantId, row.batchId, row.rowNumber, sourceRef, JSON.stringify(row.raw)],
    )
  ).rows[0] as { id: string };
  return result.id;
}

async function refExists(ctx: ImportCtx, ref: string): Promise<boolean> {
  const row = (
    await ctx.client.query('SELECT 1 FROM ticket WHERE tenant_id = $1 AND ref = $2', [
      ctx.tenantId,
      ref,
    ])
  ).rows[0];
  return Boolean(row);
}

async function markSkipped(ctx: ImportCtx, rowId: string): Promise<void> {
  await ctx.client.query("UPDATE import_row SET status = 'skipped' WHERE id = $1", [rowId]);
}

async function markImported(ctx: ImportCtx, rowId: string, ticketId: string): Promise<void> {
  await ctx.client.query(
    "UPDATE import_row SET status = 'imported', ticket_id = $1 WHERE id = $2",
    [ticketId, rowId],
  );
}

async function markError(ctx: ImportCtx, rowId: string, error: string): Promise<void> {
  await ctx.client.query("UPDATE import_row SET status = 'error', error = $1 WHERE id = $2", [
    error,
    rowId,
  ]);
}

async function importRow(ctx: ImportCtx, row: RowInput, progress: Progress): Promise<void> {
  const rowId = await insertRow(ctx, row);
  try {
    const ticket = parseTicket(row.raw);
    if (await refExists(ctx, ticket.ref)) {
      await markSkipped(ctx, rowId);
      progress.stats.skipped += 1;
      return;
    }
    const result = await importTicket(ctx.client, ctx.tenantId, ticket);
    progress.refToId.set(ticket.ref, result.ticketId);
    progress.imported.push({
      ref: ticket.ref,
      parentRef: orNull(ticket.parentRef),
      ticketId: result.ticketId,
    });
    await markImported(ctx, rowId, result.ticketId);
    progress.stats.imported += 1;
    progress.stats.events += result.events;
    progress.stats.crew += result.crew;
    progress.stats.segments += result.segments;
  } catch (error) {
    await markError(ctx, rowId, messageOf(error));
    progress.stats.errored += 1;
  }
}

async function linkParents(
  ctx: ImportCtx,
  imported: ImportedRow[],
  refToId: Map<string, string>,
): Promise<void> {
  for (const row of imported) {
    if (!row.parentRef) continue;
    const parentId =
      refToId.get(row.parentRef) ??
      (
        (
          await ctx.client.query('SELECT id FROM ticket WHERE tenant_id = $1 AND ref = $2', [
            ctx.tenantId,
            row.parentRef,
          ])
        ).rows[0] as { id: string } | undefined
      )?.id;
    if (parentId) {
      await ctx.client.query('UPDATE ticket SET parent_id = $1 WHERE id = $2', [
        parentId,
        row.ticketId,
      ]);
    }
  }
}

async function finishBatch(ctx: ImportCtx, batchId: string, stats: ImportStats): Promise<void> {
  await ctx.client.query(
    "UPDATE import_batch SET status = 'done', finished_at = now(), stats = $1 WHERE id = $2",
    [JSON.stringify(stats), batchId],
  );
}

async function runImport(
  ctx: ImportCtx,
  parsed: BhavinExport,
): Promise<{ batchId: string; stats: ImportStats }> {
  const batchId = await openBatch(ctx);
  const progress: Progress = {
    stats: emptyStats(parsed.tickets.length),
    refToId: new Map<string, string>(),
    imported: [],
  };
  for (let i = 0; i < parsed.tickets.length; i += 1) {
    await importRow(ctx, { batchId, rowNumber: i + 1, raw: parsed.tickets[i] }, progress);
  }
  await linkParents(ctx, progress.imported, progress.refToId);
  await finishBatch(ctx, batchId, progress.stats);
  return { batchId, stats: progress.stats };
}

/** Imports a Bhavin export into the tenant, idempotently, in one transaction. */
export async function importBhavin(
  pool: Pool,
  tenantId: string,
  input: unknown,
): Promise<{ batchId: string; stats: ImportStats }> {
  const parsed = bhavinExportSchema.parse(input);
  return withTenant(pool, tenantId, (client) => runImport({ client, tenantId }, parsed));
}

/** Deletes the tickets created by a batch (FK cascade) and marks the batch undone. */
export async function undoImport(
  pool: Pool,
  tenantId: string,
  batchId: string,
): Promise<{ deleted: number }> {
  return withTenant(pool, tenantId, async (client) => {
    const ticketIds = (
      await client.query(
        'SELECT ticket_id FROM import_row WHERE batch_id = $1 AND ticket_id IS NOT NULL',
        [batchId],
      )
    ).rows.map((row) => row.ticket_id as string);
    if (ticketIds.length > 0) {
      await client.query('DELETE FROM breakdown_report WHERE ticket_id = ANY($1::uuid[])', [
        ticketIds,
      ]);
      await client.query('DELETE FROM ticket WHERE id = ANY($1::uuid[])', [ticketIds]);
    }
    await client.query(
      "UPDATE import_batch SET status = 'undone', finished_at = now() WHERE id = $1",
      [batchId],
    );
    return { deleted: ticketIds.length };
  });
}
