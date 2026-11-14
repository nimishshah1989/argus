import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError } from '@uptimo/shared';
import { idOrNotFound, withTenant, type AuthContext } from '../../kernel/index.js';
import { endDevice, liveDevices } from './repo/devices.js';
import { hashToken, requireAuth } from './service.js';

/** A shared phone's colleagues must not sign each other out; they have logout. */
async function ownDevicesCaller(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return null;
  if (ctx.shared) {
    reply
      .code(403)
      .send(apiError('forbidden', 'A shared phone signs out, it does not manage devices'));
    return null;
  }
  return ctx;
}

async function list(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await ownDevicesCaller(pool, request, reply);
  if (!ctx) return;
  const items = await withTenant(pool, ctx.tenantId, (client) =>
    liveDevices(client, ctx.loginId, hashToken(ctx.token)),
  );
  reply.send({ items });
}

async function end(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await ownDevicesCaller(pool, request, reply);
  if (!ctx) return;
  const { id } = request.params as { id: string };
  if (!idOrNotFound(reply, id, 'device')) return;
  const ended = await withTenant(pool, ctx.tenantId, (client) =>
    endDevice(client, ctx.loginId, id),
  );
  if (!ended) {
    reply.code(404).send(apiError('not_found', 'Unknown device', 'id'));
    return;
  }
  reply.send({ ok: true });
}

export function registerDeviceRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/auth/sessions', (request, reply) => list(pool, request, reply));
  app.delete('/api/v1/auth/sessions/:id', (request, reply) => end(pool, request, reply));
}
