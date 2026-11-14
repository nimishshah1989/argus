import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { dayScore, type DayTicket, type TicketEvent } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { requireAuth, tenantInfo } from '../identity/index.js';
import { forbidden, mayViewBoard, offBoardMachineIds } from '../plant/index.js';
import { figureInput } from './figure-input.js';
import { rowToTicket } from './mapper.js';
import { dayTicketRows, dayWindow } from './repo/board.js';
import { loadEvents } from './repo/events.js';

type Row = Record<string, unknown>;

/** A closed ticket is read from the figures stored at its close (empty ones stay empty); an unfinished one is measured from its own events. */
async function toDayTicket(client: PoolClient, row: Row, now: Date): Promise<DayTicket> {
  if (row.status === 'cancelled') return { status: 'cancelled' };
  if (row.status === 'closed') {
    const stored = (value: unknown) => (value as number | null) ?? null;
    return {
      status: 'closed',
      figures: {
        responseMin: stored(row.response_min),
        repairMin: stored(row.repair_min),
        waitMin: stored(row.wait_min),
      },
    };
  }
  const ticket = rowToTicket(row);
  const events = (await loadEvents(client, ticket.id)) as unknown as TicketEvent[];
  const overrides = (row.overrides as Record<string, unknown> | null) ?? {};
  return {
    status: row.status as 'open' | 'working' | 'waiting',
    input: figureInput(ticket, events, [], { overrides, now }),
  };
}

/** `GET /api/v1/board/today`: whoever may see the live board gets the plant's day score (shared `boardTodayReplySchema`). */
export async function boardToday(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const now = new Date();
  const today = await withTenant(pool, ctx.tenantId, async (client) => {
    if (!(await mayViewBoard(client, ctx))) return null;
    const window = await dayWindow(client, (await tenantInfo(client, ctx.tenantId)).time_zone, now);
    const offBoard = await offBoardMachineIds(client, ctx.tenantId);
    const tickets: DayTicket[] = [];
    for (const row of await dayTicketRows(client, ctx.tenantId, window, offBoard)) {
      tickets.push(await toDayTicket(client, row, now));
    }
    return { window, score: dayScore(tickets, now) };
  });
  if (!today) return forbidden(reply);
  const { window, score } = today;
  reply.send({
    now: now.toISOString(),
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    ...score,
  });
}
