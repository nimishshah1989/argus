import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PoolClient } from 'pg';

/**
 * The storage adapter. Local disk in development and tests; the S3 adapter will
 * implement the same two calls (`put`/`get`) behind a presigned URL.
 */
export interface ObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

export function createLocalFileStore(root: string): ObjectStore {
  return {
    async put(key, bytes) {
      const path = join(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    async get(key) {
      return readFile(join(root, key));
    },
  };
}

export function pdfObjectKey(tenantId: string, ticketId: string): string {
  return `${tenantId}/pdf/${ticketId}/${randomUUID()}.pdf`;
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface NewFile {
  tenantId: string;
  ticketId: string;
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
