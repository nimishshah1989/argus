import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { SIGNOFF_FEED_MAX, type SignoffFeed } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { forbidden, mayViewBoard, offBoardMachineIds } from '../plant/index.js';
import { closedAwaitingSignoff, type SignoffCursor } from '../tickets/index.js';
import { loadHandbacks } from './handback.js';
import { firedHandbackTickets } from './repo/handback-timers.js';

/**
 * Oldest close first, a page at a time, until the feed is full. Tickets whose clock has run out are dropped before
 * anything is loaded for them; a few pages are looked at so that a run of them does not hide a newer ticket that is
 * still waiting (a plant may give some severities a longer time than others).
 */
const MAX_PAGES = 6;

type Item = SignoffFeed['items'][number];

async function waitingTickets(client: PoolClient, tenantId: string, now: Date): Promise<Item[]> {
  const offBoard = await offBoardMachineIds(client, tenantId);
  const items: Item[] = [];
  let after: SignoffCursor | undefined;
  for (let page = 0; page < MAX_PAGES && items.length < SIGNOFF_FEED_MAX; page++) {
    const rows = await closedAwaitingSignoff(client, tenantId, {
      limit: SIGNOFF_FEED_MAX,
      after,
      offBoard,
    });
    const last = rows.at(-1);
    if (!last) break;
    after = { closedAt: last.closedAtText, id: last.id };
    const fired = await firedHandbackTickets(
      client,
      tenantId,
      rows.map((row) => row.id),
      now,
    );
    const live = rows.filter((row) => !fired.has(row.id));
    // The sign-off itself has the final say: only a status of `requested` is shown.
    const handbacks = await loadHandbacks(
      client,
      tenantId,
      live.map((row) => row.id),
      now,
    );
    for (const row of live) {
      const handback = handbacks.get(row.id);
      if (handback?.status !== 'requested') continue;
      items.push({
        ticketId: row.id,
        ref: row.ref,
        machine: row.machineId ? { id: row.machineId, code: row.machineCode } : null,
        cell: row.cell,
        closedAt: row.closedAt.toISOString(),
        requestedAt: handback.requestedAt,
        dueAt: handback.dueAt,
      });
    }
    if (rows.length < SIGNOFF_FEED_MAX) break;
  }
  return items.slice(0, SIGNOFF_FEED_MAX);
}

/**
 * `GET /api/v1/board/signoff`: whoever may see the board gets the closed tickets still waiting for production to
 * answer (status `requested`, not timed out), oldest close first: the longest wait at the top. Machines kept off the
 * board stay off it here.
 */
async function signoffFeed(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const now = new Date();
  const items = await withTenant(pool, ctx.tenantId, async (client) =>
    (await mayViewBoard(client, ctx)) ? waitingTickets(client, ctx.tenantId, now) : null,
  );
  if (!items) return forbidden(reply);
  reply.send({ items });
}

export function registerSignoffFeed(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/board/signoff', (request, reply) => signoffFeed(pool, request, reply));
}
