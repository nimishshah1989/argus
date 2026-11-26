import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import {
  SIGNOFF_FEED_MAX,
  SIGNOFF_OUTCOME_HOURS,
  type SignoffFeed,
  type SignoffOutcome,
} from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { forbidden, mayViewBoard, offBoardMachineIds } from '../plant/index.js';
import {
  closedAwaitingSignoff,
  signoffOutcomeTickets,
  type SignoffCursor,
} from '../tickets/index.js';
import { loadHandbacks } from './handback.js';
import { firedHandbackTickets, handbackTimedOutSince } from './repo/handback-timers.js';

/**
 * Oldest close first, a page at a time, until the feed is full. Tickets whose clock has run out are dropped before
 * anything is loaded for them; a few pages are looked at so that a run of them does not hide a newer ticket that is
 * still waiting (a plant may give some severities a longer time than others).
 */
const MAX_PAGES = 6;

type Item = SignoffFeed['items'][number];

async function waitingTickets(
  client: PoolClient,
  tenantId: string,
  now: Date,
  offBoard: string[],
): Promise<Item[]> {
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

const HOUR_MS = 3_600_000;

/**
 * The sign-offs answered or timed out in the last `SIGNOFF_OUTCOME_HOURS`, newest first: the sign-off itself (the
 * same one the ticket page shows) decides each outcome, so a ticket closed again and waiting is not listed here.
 */
async function recentOutcomes(
  client: PoolClient,
  tenantId: string,
  now: Date,
  offBoard: string[],
): Promise<SignoffOutcome[]> {
  const since = new Date(now.getTime() - SIGNOFF_OUTCOME_HOURS * HOUR_MS);
  const timedOut = await handbackTimedOutSince(client, tenantId, { since, now });
  const rows = await signoffOutcomeTickets(client, tenantId, {
    since,
    offBoard,
    alsoIds: [...timedOut.keys()],
    limit: SIGNOFF_FEED_MAX * 2,
  });
  const handbacks = await loadHandbacks(
    client,
    tenantId,
    rows.map((row) => row.id),
    now,
  );
  const outcomes: SignoffOutcome[] = [];
  for (const row of rows) {
    const handback = handbacks.get(row.id);
    if (!handback) continue;
    // The clock that fired has the last word on a timeout, as the waiting list above drops the ticket for it.
    const firedAt = handback.status === 'requested' ? timedOut.get(row.id) : undefined;
    const status = firedAt ? 'timed_out' : handback.status;
    if (status === 'requested') continue;
    const at = firedAt ?? (status === 'timed_out' ? handback.dueAt : handback.respondedAt);
    if (!at || Date.parse(at) < since.getTime()) continue;
    outcomes.push({
      ticketId: row.id,
      ref: row.ref,
      machine: row.machineId ? { id: row.machineId, code: row.machineCode } : null,
      cell: row.cell,
      status,
      requestedAt: handback.requestedAt,
      at,
      byPersonId: handback.respondedByPersonId,
      reason: handback.disputeReason,
    });
  }
  outcomes.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.ticketId.localeCompare(b.ticketId),
  );
  return outcomes.slice(0, SIGNOFF_FEED_MAX);
}

/**
 * `GET /api/v1/board/signoff`: whoever may see the board gets the closed tickets still waiting for production to
 * answer (status `requested`, not timed out), oldest close first: the longest wait at the top; and the outcomes of the
 * last day. Machines kept off the board stay off it here.
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
    const offBoard = await offBoardMachineIds(client, ctx.tenantId);
    return {
      items: await waitingTickets(client, ctx.tenantId, now, offBoard),
      outcomes: await recentOutcomes(client, ctx.tenantId, now, offBoard),
    };
  });
  if (!feed) return forbidden(reply);
  reply.send(feed);
}

export function registerSignoffFeed(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/board/signoff', (request, reply) => signoffFeed(pool, request, reply));
}
