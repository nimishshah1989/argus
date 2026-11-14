import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/**
 * The storage adapter. Local disk in development and tests; the S3 adapter will
 * implement the same two calls (`put`/`get`) behind a presigned URL.
 */
export interface ObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/** The path of a stored key, refusing any key that would leave the storage folder. */
function pathOf(root: string, key: string): string {
  const base = resolve(root);
  const path = resolve(base, key);
  if (!path.startsWith(base + sep)) throw new Error('File key outside the storage folder');
  return path;
}

export function createLocalFileStore(root: string): ObjectStore {
  return {
    async put(key, bytes) {
      const path = pathOf(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    async get(key) {
      return readFile(pathOf(root, key));
    },
  };
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
