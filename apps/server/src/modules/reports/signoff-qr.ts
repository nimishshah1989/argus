import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { apiError, isUuid } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import type { AppConfig } from '../../kernel/index.js';
import { requireAuth, tenantSlugFromHost } from '../identity/index.js';
import { forbidden, mayViewBoard } from '../plant/index.js';
import { refsByIds } from '../tickets/index.js';
import { qrSvg } from './pdf.js';

const SLUG = /^[a-z0-9-]+$/;

/**
 * The address a phone scanning the QR should open: `https://<slug>.<configured domain>/floor/signoff/<id>`. The domain
 * is the plant's own setting, never the request's. The slug is the first label of the host the request came to, which
 * the sign-in check has already matched to this login's own plant (a host naming another plant is refused before here).
 */
function signoffLink(domain: string, request: FastifyRequest, ticketId: string): string | null {
  const slug = tenantSlugFromHost(request.headers.host ?? '');
  return slug && SLUG.test(slug) ? `https://${slug}.${domain}/floor/signoff/${ticketId}` : null;
}

/**
 * `GET /api/v1/tickets/:id/signoff-qr`: the QR the board shows for a ticket waiting for sign-off, as an SVG. For
 * whoever may see the board; another plant's ticket is unknown. Without PUBLIC_BASE_DOMAIN it answers 503.
 */
async function signoffQr(
  config: AppConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(config.pool, request, reply);
  if (!ctx) return;
  const { id } = request.params as { id: string };
  const known = await withTenant(config.pool, ctx.tenantId, async (client) => {
    if (!(await mayViewBoard(client, ctx))) return null;
    return isUuid(id) && (await refsByIds(client, ctx.tenantId, [id])).has(id);
  });
  if (known === null) return forbidden(reply);
  if (!config.publicBaseDomain) {
    reply
      .code(503)
      .send(apiError('not_configured', 'The company address for QR codes is not set up yet'));
    return;
  }
  const link = known ? signoffLink(config.publicBaseDomain, request, id) : null;
  if (!link) {
    reply.code(404).send(apiError('not_found', known ? 'Unknown company' : 'Unknown ticket', 'id'));
    return;
  }
  reply.header('content-type', 'image/svg+xml; charset=utf-8').send(await qrSvg(link));
}

export function registerSignoffQr(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/v1/tickets/:id/signoff-qr', (request, reply) => signoffQr(config, request, reply));
}
