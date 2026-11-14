import type { FastifyInstance, FastifyReply } from 'fastify';
import { apiError, isUuid } from '@uptimo/shared';
import { withTenant, type AppConfig } from '../../kernel/index.js';
import { requireAuth, resolveTenant, tenantLogoId, tenantSlugFromHost } from '../identity/index.js';
import { selectFile } from './repo.js';
import { sha256 } from './store.js';

/**
 * What `GET /files/:id` will hand out: plant logos (their bytes are in the row), as images only. Ticket PDFs are rendered on request and
 * never stored (#182); photos, voice notes, signatures and import files hold people's data and wait for
 * their own permission rules, so they answer 404 here.
 */
const SERVED = new Map([['logo', new Set(['image/png', 'image/jpeg', 'image/webp'])]]);

/** Sends one stored file of this plant as an image, or answers 404 / 500; the one place that decides how. */
async function sendFile(
  config: AppConfig,
  reply: FastifyReply,
  target: { tenantId: string; id: string },
) {
  const notFound = () => reply.code(404).send(apiError('not_found', 'Unknown file', 'id'));
  if (!isUuid(target.id)) return notFound();
  const file = await withTenant(config.pool, target.tenantId, (tx) => selectFile(tx, target.id));
  if (!file || !SERVED.get(file.kind)?.has(file.mime)) return notFound();
  const bytes = file.content;
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
}

export function registerFiles(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/v1/files/:id', async (request, reply) => {
    const ctx = await requireAuth(config.pool, request, reply);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    return sendFile(config, reply, { tenantId: ctx.tenantId, id });
  });
  // Public: the sign-in page shows the logo of the company at this address, and of no other.
  app.get('/api/v1/brand/logo', async (request, reply) => {
    const slug = tenantSlugFromHost(request.headers.host ?? '');
    const tenant = slug ? await resolveTenant(config.pool, slug) : null;
    const id = tenant ? await tenantLogoId(config.pool, tenant.slug) : null;
    if (!tenant || !id) return reply.code(404).send(apiError('not_found', 'No logo', 'id'));
    return sendFile(config, reply, { tenantId: tenant.id, id });
  });
}
