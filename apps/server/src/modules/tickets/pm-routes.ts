import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { canAnalytics, canSettingsLists } from '@uptimo/domain';
import { apiError, pmCalendarQuerySchema, pmRescheduleSchema } from '@uptimo/shared';
import { fieldProblem, withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf } from '../plant/index.js';
import * as idem from './repo/idempotency.js';
import { runOutcome } from './outcome.js';
import { pmCalendarFor } from './pm-calendar.js';
import { reschedulePm } from './pm-reschedule.js';

type Ctx = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;

const REFUSAL = 'You do not have permission for this action';

function gate(ctx: Ctx, reply: FastifyReply, allowed: boolean): boolean {
  if (allowed) return true;
  reply.code(403).send(apiError('forbidden', REFUSAL));
  return false;
}

/**
 * `GET /api/v1/pm/calendar?from&to` (R10): the supervisors, heads, plant heads and admins who can read analytics.
 * The range is the grid's six weeks, both ends inclusive; the reply is one occurrence per machine.
 */
async function sendCalendar(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!gate(ctx, reply, canAnalytics(actorOf(ctx)))) return;
  const parsed = pmCalendarQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    const refusal = fieldProblem(parsed.error);
    reply.code(refusal.status).send(refusal.body);
    return;
  }
  const body = await withTenant(pool, ctx.tenantId, (client) =>
    pmCalendarFor(client, ctx.tenantId, parsed.data),
  );
  reply.send(body);
}

/**
 * `POST /api/v1/pm/reschedule` (R3/R10): a head or admin moves one job. The body is strict, the key is required,
 * a replay returns the stored reply and a reused key with another body is a 422; the write itself is in one
 * tenant transaction and touches only the ticket.
 */
async function sendReschedule(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!gate(ctx, reply, canSettingsLists(actorOf(ctx)))) return;

  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply.code(422).send(apiError('validation', idem.KEY_REQUIRED, 'idempotencyKey'));
    return;
  }
  const parsed = pmRescheduleSchema.safeParse(request.body);
  if (!parsed.success) {
    const refusal = fieldProblem(parsed.error);
    reply.code(refusal.status).send(refusal.body);
    return;
  }

  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    'pm-reschedule',
    parsed.data,
    idem.phoneActor(ctx),
  ]);
  const outcome = await runOutcome(pool, binding, async (client) => {
    const existing = await idem.getIdempotent(client, binding);
    if (existing) return existing;
    const result = await reschedulePm(client, {
      tenantId: ctx.tenantId,
      machineId: parsed.data.machineId,
      planId: parsed.data.planId ?? null,
      ticketId: parsed.data.ticketId ?? null,
      scheduledOn: parsed.data.scheduledOn,
      loginId: ctx.loginId,
      actingPersonId: ctx.personId,
      now: new Date(),
    });
    if (result.status === 200)
      await idem.storeIdempotent(client, { ...binding, command: 'pm-reschedule', result });
    return result;
  });
  reply.code(outcome.status).send(outcome.body);
}

/** The PM calendar's two routes; registered by `registerTickets` (R11: no new module). */
export function registerPmRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/pm/calendar', (request, reply) => sendCalendar(pool, request, reply));
  app.post('/api/v1/pm/reschedule', (request, reply) => sendReschedule(pool, request, reply));
}
