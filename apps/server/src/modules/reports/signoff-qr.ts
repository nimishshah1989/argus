import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError, isUuid } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { forbidden, mayViewBoard } from '../plant/index.js';
import { refsByIds } from '../tickets/index.js';
import { qrSvg } from './pdf.js';

/**
 * `GET /api/v1/tickets/:id/signoff-qr`: the QR the board shows for a ticket waiting for sign-off. It encodes the
 * ticket's sign-off page on the address the request came to (`/floor/signoff/:id`), so a phone that scans it lands on
 * the same company's page. For whoever may see the board; another plant's ticket is unknown.
 */
async function signoffQr(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const { id } = request.params as { id: string };
  const known = await withTenant(pool, ctx.tenantId, async (client) => {
    if (!(await mayViewBoard(client, ctx))) return null;
    return isUuid(id) && (await refsByIds(client, ctx.tenantId, [id])).has(id);
  });
  if (known === null) return forbidden(reply);
  if (!known) {
    reply.code(404).send(apiError('not_found', 'Unknown ticket', 'id'));
    return;
  }
  const link = `${request.protocol}://${request.headers.host}/floor/signoff/${id}`;
  reply.header('content-type', 'image/svg+xml; charset=utf-8').send(await qrSvg(link));
}

export function registerSignoffQr(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/tickets/:id/signoff-qr', (request, reply) => signoffQr(pool, request, reply));
}
