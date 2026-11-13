import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

/** Day reports are tenant-scoped, not tied to a ticket. */
export function dayReportObjectKey(tenantId: string, date: string, shift: string): string {
  return `${tenantId}/reports/day-${date}-${shift}-${randomUUID()}.pdf`;
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
