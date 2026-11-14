import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { apiError, isUuid } from '@uptimo/shared';
import { withTenant, type AppConfig } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { selectFile } from './repo.js';
import { createLocalFileStore, sha256, type ObjectStore } from './store.js';

/**
 * What `GET /files/:id` will hand out: plant logos, as images only. Ticket PDFs are rendered on request and
 * never stored (#182); photos, voice notes, signatures and import files hold people's data and wait for
 * their own permission rules, so they answer 404 here.
 */
const SERVED = new Map([['logo', new Set(['image/png', 'image/jpeg', 'image/webp'])]]);

const stores = new WeakMap<AppConfig, ObjectStore>();

/** The storage behind the `file` rows: `filesDir`, else `FILES_DIR`, else `data/files` beside the server. */
export function storeFor(config: AppConfig): ObjectStore {
  let store = stores.get(config);
  if (!store) {
    store = createLocalFileStore(config.filesDir ?? process.env.FILES_DIR ?? join('data', 'files'));
    stores.set(config, store);
  }
  return store;
}

export function registerFiles(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/v1/files/:id', async (request, reply) => {
    const ctx = await requireAuth(config.pool, request, reply);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    const notFound = () => reply.code(404).send(apiError('not_found', 'Unknown file', 'id'));
    if (!isUuid(id)) return notFound();
    const file = await withTenant(config.pool, ctx.tenantId, (tx) => selectFile(tx, id));
    if (!file || !SERVED.get(file.kind)?.has(file.mime)) return notFound();
    const bytes = await storeFor(config)
      .get(file.key)
      .catch(() => null);
    if (!bytes) return notFound();
    if (sha256(bytes) !== file.sha256) {
      return reply.code(500).send(apiError('internal', 'Stored file does not match its record'));
    }
    return reply
      .header('content-type', file.mime)
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'; sandbox")
      .header('cache-control', 'private, max-age=3600')
      .send(bytes);
  });
}
