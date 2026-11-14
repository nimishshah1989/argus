import type { PoolClient } from 'pg';
import { sha256 } from './store.js';

export interface NewFile {
  tenantId: string;
  ticketId?: string | null;
  key: string;
  mime: string;
  bytes: Buffer;
  /** Defaults to a rendered PDF; a logo upload says `logo` and who sent it. */
  kind?: 'pdf' | 'logo';
  uploadedBy?: string | null;
  /** A logo's bytes are kept in the row itself (at most 256 KB, enforced by the database). */
  content?: Buffer;
}

/** Insert the `file` row for a rendered PDF and return its id. */
export async function insertFileRow(client: PoolClient, file: NewFile): Promise<string> {
  const result = await client.query(
    `INSERT INTO file (tenant_id, kind, s3_key, mime, bytes, sha256, ticket_id, uploaded_by, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      file.tenantId,
      file.kind ?? 'pdf',
      file.key,
      file.mime,
      file.bytes.length,
      sha256(file.bytes),
      file.ticketId ?? null,
      file.uploadedBy ?? null,
      file.content ?? null,
    ],
  );
  return result.rows[0].id as string;
}

export interface StoredFile {
  id: string;
  kind: string;
  mime: string;
  sha256: string;
  /** Null for a file whose bytes are not kept in the database. */
  content: Buffer | null;
}

/** One file row of the signed-in plant; another plant's id finds nothing (row security). */
export async function selectFile(
  client: Pick<PoolClient, 'query'>,
  id: string,
): Promise<StoredFile | undefined> {
  const row = (
    await client.query('SELECT id, kind, mime, sha256, content FROM file WHERE id = $1', [id])
  ).rows[0];
  return (
    row && { id: row.id, kind: row.kind, mime: row.mime, sha256: row.sha256, content: row.content }
  );
}
