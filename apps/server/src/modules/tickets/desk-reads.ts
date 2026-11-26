import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { liveCrew, recentCodesOfLogin } from './repo/desk-reads.js';

/**
 * Two reads the desk and the close form add to `/state`:
 * - `GET /api/v1/state/crew`: who is on each working or paused ticket and in which crew role. Any login reads it, as it
 *   reads `/state`, whose open tickets already carry their lead.
 * - `GET /api/v1/tickets/recent-codes`: the codes this login used last on a close, for the close form to offer first.
 */
export function registerDeskReads(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/state/crew', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const items = await withTenant(pool, ctx.tenantId, (client) => liveCrew(client, ctx.tenantId));
    reply.send({ items });
  });
  app.get('/api/v1/tickets/recent-codes', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const codes = await withTenant(pool, ctx.tenantId, (client) =>
      recentCodesOfLogin(client, ctx.tenantId, ctx.loginId),
    );
    reply.send(codes);
  });
}
