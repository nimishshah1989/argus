import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { SIGNOFF_FEED_MAX, type SignoffFeed } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { forbidden, mayViewBoard } from '../plant/index.js';
import { closedAwaitingSignoff } from '../tickets/index.js';
import { loadHandbacks } from './handback.js';

/** Looked at newest first; a ticket whose time to answer has run out is dropped, so a few more are read than shown. */
const CANDIDATES = SIGNOFF_FEED_MAX * 4;

/**
 * `GET /api/v1/board/signoff`: whoever may see the board gets the closed tickets still waiting for production to
 * answer (status `requested`, not timed out), newest close first.
 */
async function signoffFeed(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const now = new Date();
  const feed = await withTenant(pool, ctx.tenantId, async (client): Promise<SignoffFeed | null> => {
    if (!(await mayViewBoard(client, ctx))) return null;
    const rows = await closedAwaitingSignoff(client, ctx.tenantId, CANDIDATES);
    const handbacks = await loadHandbacks(
      client,
      ctx.tenantId,
      rows.map((row) => row.id),
      now,
    );
    const items = rows.flatMap((row) => {
      const handback = handbacks.get(row.id);
      if (handback?.status !== 'requested') return [];
      return [
        {
          ticketId: row.id,
          ref: row.ref,
          machine: row.machineId ? { id: row.machineId, code: row.machineCode } : null,
          cell: row.cell,
          closedAt: row.closedAt.toISOString(),
          requestedAt: handback.requestedAt,
          dueAt: handback.dueAt,
        },
      ];
    });
    return { items: items.slice(0, SIGNOFF_FEED_MAX) };
  });
  if (!feed) return forbidden(reply);
  reply.send(feed);
}

export function registerSignoffFeed(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/board/signoff', (request, reply) => signoffFeed(pool, request, reply));
}
