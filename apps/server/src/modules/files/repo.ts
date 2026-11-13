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
