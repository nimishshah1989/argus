import type { PoolClient } from 'pg';
import { sha256 } from './store.js';

export interface NewFile {
  tenantId: string;
  ticketId: string | null;
  key: string;
  mime: string;
  bytes: Buffer;
}

/** Insert the `file` row for a rendered PDF and return its id. */
export async function insertFileRow(client: PoolClient, file: NewFile): Promise<string> {
  const result = await client.query(
    `INSERT INTO file (tenant_id, kind, s3_key, mime, bytes, sha256, ticket_id)
     VALUES ($1, 'pdf', $2, $3, $4, $5, $6) RETURNING id`,
    [file.tenantId, file.key, file.mime, file.bytes.length, sha256(file.bytes), file.ticketId],
  );
  return result.rows[0].id as string;
}

export interface StoredFile {
  id: string;
  kind: string;
  key: string;
  mime: string;
  sha256: string;
}

/** One file row of the signed-in plant; another plant's id finds nothing (row security). */
export async function selectFile(
  client: Pick<PoolClient, 'query'>,
  id: string,
): Promise<StoredFile | undefined> {
  const row = (
    await client.query('SELECT id, kind, s3_key, mime, sha256 FROM file WHERE id = $1', [id])
  ).rows[0];
  return row && { id: row.id, kind: row.kind, key: row.s3_key, mime: row.mime, sha256: row.sha256 };
}
