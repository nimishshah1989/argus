import type { PoolClient, QueryResult } from 'pg';

type Db = Pick<PoolClient, 'query'>;
type Rows = QueryResult['rows'];

export async function insertBatch(
  tx: Db,
  input: { tenantId: string; startedAt: Date; stats: string },
): Promise<string> {
  const result = await tx.query(
    `INSERT INTO import_batch (tenant_id, source, status, started_at, stats)
       VALUES ($1, 'bhavin', 'running', $2, $3) RETURNING id`,
    [input.tenantId, input.startedAt, input.stats],
  );
  return result.rows[0].id as string;
}

/** Marks a running batch failed; returns the row count (1 when it was running). */
export async function failBatch(
  tx: Db,
  input: { stats: string; batchId: string; tenantId: string },
): Promise<number | null> {
  const result = await tx.query(
    `UPDATE import_batch SET status = 'failed', finished_at = clock_timestamp(), stats = $1
       WHERE id = $2 AND tenant_id = $3 AND source = 'bhavin' AND status = 'running'`,
    [input.stats, input.batchId, input.tenantId],
  );
  return result.rowCount;
}

export async function finishBatch(
  tx: Db,
  input: { status: string; stats: string; batchId: string; tenantId: string },
): Promise<void> {
  // The database clock: the import's rows carry the transaction's now(), which is later than any clock read before it.
  await tx.query(
    `UPDATE import_batch SET status = $1, finished_at = clock_timestamp(), stats = $2
       WHERE id = $3 AND tenant_id = $4 AND source = 'bhavin'`,
    [input.status, input.stats, input.batchId, input.tenantId],
  );
}

export async function updateImportRow(
  tx: Db,
  input: {
    status: 'imported' | 'skipped' | 'error';
    ticketId?: string;
    error?: string;
    rowId: string;
    tenantId: string;
    batchId: string;
  },
): Promise<void> {
  await tx.query(
    `UPDATE import_row SET status = $1, ticket_id = $2, error = $3
     WHERE id = $4 AND tenant_id = $5 AND batch_id = $6`,
    [
      input.status,
      input.ticketId ?? null,
      input.error ?? null,
      input.rowId,
      input.tenantId,
      input.batchId,
    ],
  );
}

interface NewImportRow {
  tenantId: string;
  batchId: string;
  rowNumber: number;
  sourceRef: string | null;
  payload: string;
}

export async function insertPendingRow(tx: Db, row: NewImportRow): Promise<string> {
  const result = await tx.query(
    `INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
    [row.tenantId, row.batchId, row.rowNumber, row.sourceRef, row.payload],
  );
  return result.rows[0].id as string;
}

export async function insertErrorRow(tx: Db, row: NewImportRow): Promise<void> {
  await tx.query(
    `INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload, error)
     VALUES ($1,$2,$3,$4,'error',$5,'raw_insert_failed')`,
    [row.tenantId, row.batchId, row.rowNumber, row.sourceRef, row.payload],
  );
}

/**
 * `erase_person` empties the stored raw envelope of any row that named the person (`{}`): the source text is the
 * personal data. Retention's purge keeps the format and hashes, so this is the only shape with no keys. Such a row
 * still says which ticket it made and which source id it came from, and nothing else.
 */
export const isErasedPayload = (payload: unknown): boolean =>
  typeof payload !== 'object' || payload === null || Object.keys(payload).length === 0;

/** How many rows of a batch had their raw envelope erased with a person. */
export async function erasedRowCount(tx: Db, tenantId: string, batchId: string): Promise<number> {
  const result = await tx.query(
    `SELECT count(*)::int AS n FROM import_row
     WHERE tenant_id = $1 AND batch_id = $2 AND payload = '{}'::jsonb`,
    [tenantId, batchId],
  );
  return result.rows[0].n as number;
}

export async function importedRowRows(tx: Db, tenantId: string, batchId: string): Promise<Rows> {
  const result = await tx.query(
    `SELECT row_number, source_ref, ticket_id, payload FROM import_row
     WHERE tenant_id = $1 AND batch_id = $2 AND status = 'imported' ORDER BY ticket_id`,
    [tenantId, batchId],
  );
  return result.rows;
}

/** Imported or skipped rows of finished batches of one contract (the ref is joined in by the caller). */
export async function provenanceRows(tx: Db, tenantId: string, contract: string): Promise<Rows> {
  const result = await tx.query(
    `SELECT r.source_ref, r.ticket_id, r.status, r.payload
     FROM import_row r
     JOIN import_batch b ON b.id = r.batch_id AND b.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1 AND b.source = 'bhavin' AND b.status IN ('done','failed')
       AND b.stats->>'contract' = $2 AND r.status IN ('imported','skipped')`,
    [tenantId, contract],
  );
  return result.rows;
}

export async function lockBatchRow(
  tx: Db,
  tenantId: string,
  batchId: string,
): Promise<{ status?: string; stats?: unknown } | undefined> {
  const result = await tx.query(
    `SELECT status, stats FROM import_batch
     WHERE id = $1 AND tenant_id = $2 AND source = 'bhavin' FOR UPDATE`,
    [batchId, tenantId],
  );
  return result.rows[0];
}

/**
 * Retention: drops the source content (`raw`, `canonicalJson`) of rows whose batch finished before `cutoff` (done, failed or
 * undone: all hold personal data in the raw payload). Keeps what a later replay and undo read: the format, both hashes and the entry type. Marked `purged`,
 * so a second run finds nothing. The row, its ticket link and the batch stay.
 */
export async function stripOldImportPayloads(
  tx: Db,
  tenantId: string,
  cutoff: Date,
): Promise<number> {
  const result = await tx.query(
    `UPDATE import_row r SET updated_at = now(), payload = jsonb_build_object(
         'format', r.payload -> 'format', 'rawSha256', r.payload -> 'rawSha256',
         'identitySha256', r.payload -> 'identitySha256',
         'raw', jsonb_build_object('entryType', r.payload #> '{raw,entryType}'), 'purged', true)
     FROM import_batch b
     WHERE r.tenant_id = $1 AND b.id = r.batch_id AND b.tenant_id = r.tenant_id
       AND b.status IN ('done', 'failed', 'undone') AND b.finished_at < $2
       AND r.payload ->> 'format' = 'argus.import-raw/v1' AND NOT (r.payload ? 'purged')`,
    [tenantId, cutoff],
  );
  return result.rowCount ?? 0;
}

export async function countImportBatches(tx: Db, tenantId: string): Promise<number> {
  const result = await tx.query(
    'SELECT count(*)::int AS n FROM import_batch WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows[0].n as number;
}
