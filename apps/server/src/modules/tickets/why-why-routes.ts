import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { canAnalytics } from '@uptimo/domain';
import { apiError, isUuid, whyWhyWriteSchema } from '@uptimo/shared';
import { fieldProblem, refuse, withTenant, type Refusal } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf } from '../plant/index.js';
import {
  loadWhyWhy,
  saveWhyWhy,
  whyWhyState,
  WHY_WHY_READ_REFUSAL,
  WHY_WHY_WRITE_REFUSAL,
  type WhyWhyState,
} from './why-why.js';

type Ctx = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;

const MISSING = refuse(404, 'not_found', 'Unknown ticket');
const NOT_BREAKDOWN = refuse(409, 'conflict', 'not-a-breakdown');

function stateRefusal(state: Exclude<WhyWhyState, 'ok'>): Refusal {
  return state === 'missing' ? MISSING : NOT_BREAKDOWN;
}

/** 403 with the named refusal; null when the caller may read a Why-Why. */
function readGate(ctx: Ctx, reply: FastifyReply): boolean {
  if (canAnalytics(actorOf(ctx))) return true;
  reply.code(403).send(apiError('forbidden', WHY_WHY_READ_REFUSAL));
  return false;
}

/** 403 with the named refusal; null when the caller may save a Why-Why (R3's canAnalytics roles). */
function writeGate(ctx: Ctx, reply: FastifyReply): boolean {
  if (canAnalytics(actorOf(ctx))) return true;
  reply.code(403).send(apiError('forbidden', WHY_WHY_WRITE_REFUSAL));
  return false;
}

/** The ticket id in the path, or a 404 when it can name no row (before the body is read). */
function ticketId(request: FastifyRequest, reply: FastifyReply): string | null {
  const id = (request.params as { id: string }).id;
  if (isUuid(id)) return id;
  reply.code(404).send(MISSING.body);
  return null;
}

/**
 * GET /api/v1/tickets/:id/why-why: the latest saved record, or null. The ticket must be this plant's and a
 * closed breakdown; a technician, operator or board login is refused by name.
 */
async function sendWhyWhy(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!readGate(ctx, reply)) return;
  const id = ticketId(request, reply);
  if (!id) return;
  const outcome = await withTenant(pool, ctx.tenantId, async (tx) => {
    const state = await whyWhyState(tx, ctx.tenantId, id);
    if (state !== 'ok') return { state };
    return { state, record: await loadWhyWhy(tx, ctx.tenantId, id) };
  });
  if (outcome.state !== 'ok') {
    const refusal = stateRefusal(outcome.state);
    reply.code(refusal.status).send(refusal.body);
    return;
  }
  reply.send(outcome.record);
}

/**
 * PUT /api/v1/tickets/:id/why-why: appends one record and answers it with 201. The author and plant date are the
 * session's, never the body's; a body field for either is a 422 naming the field.
 */
async function putWhyWhy(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!writeGate(ctx, reply)) return;
  const parsed = whyWhyWriteSchema.safeParse(request.body);
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    reply.code(status).send(body);
    return;
  }
  const id = ticketId(request, reply);
  if (!id) return;
  if (!ctx.personId) {
    reply.code(403).send(apiError('choose_acting_person', 'Choose who is acting'));
    return;
  }
  const now = new Date();
  const outcome = await withTenant(pool, ctx.tenantId, async (tx) => {
    const state = await whyWhyState(tx, ctx.tenantId, id);
    if (state !== 'ok') return { state };
    const record = await saveWhyWhy(tx, {
      tenantId: ctx.tenantId,
      ticketId: id,
      loginId: ctx.loginId,
      personId: ctx.personId as string,
      body: parsed.data,
      now,
    });
    // The closed-breakdown guard is inside the append as well: a ticket that changed in between is a 409.
    if (!record) return { state: 'not-breakdown' as const };
    return { state: 'ok' as const, record };
  });
  if (outcome.state !== 'ok') {
    const refusal = stateRefusal(outcome.state);
    reply.code(refusal.status).send(refusal.body);
    return;
  }
  reply.code(201).send(outcome.record);
}

export function registerWhyWhyRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/tickets/:id/why-why', (request, reply) => sendWhyWhy(pool, request, reply));
  app.put('/api/v1/tickets/:id/why-why', (request, reply) => putWhyWhy(pool, request, reply));
}
