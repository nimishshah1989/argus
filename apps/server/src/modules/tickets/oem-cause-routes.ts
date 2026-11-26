import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { canAnalytics } from '@uptimo/domain';
import { apiError, isUuid, oemCausePayloadSchema, oemCauseWriteSchema } from '@uptimo/shared';
import { fieldProblem, refuse, withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf, plantToday } from '../plant/index.js';
import { appendOemCauseEvent } from './repo/events.js';
import { whyWhyState } from './why-why.js';

/** The refusal an operator, technician or board login gets on a save (the Why-Why roles decide, ADR 0051 A3). */
export const OEM_CAUSE_WRITE_REFUSAL =
  'Only a supervisor, head, plant head or admin may save an OEM cause';

const MISSING = refuse(404, 'not_found', 'Unknown ticket');
const NOT_BREAKDOWN = refuse(409, 'conflict', 'not-a-breakdown');

async function putOemCause(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canAnalytics(actorOf(ctx))) {
    reply.code(403).send(apiError('forbidden', OEM_CAUSE_WRITE_REFUSAL));
    return;
  }
  const parsed = oemCauseWriteSchema.safeParse(request.body);
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    reply.code(status).send(body);
    return;
  }
  const id = (request.params as { id: string }).id;
  if (!isUuid(id)) {
    reply.code(MISSING.status).send(MISSING.body);
    return;
  }
  if (!ctx.personId) {
    reply.code(403).send(apiError('choose_acting_person', 'Choose who is acting'));
    return;
  }
  const personId = ctx.personId as string;
  const now = new Date();
  const outcome = await withTenant(pool, ctx.tenantId, async (tx) => {
    const state = await whyWhyState(tx, ctx.tenantId, id);
    if (state !== 'ok') return { state };
    const payload = oemCausePayloadSchema.parse({
      cause: parsed.data.cause,
      decidedBy: personId,
      decidedDate: await plantToday(tx, ctx.tenantId, now),
    });
    const event = await appendOemCauseEvent(tx, {
      tenantId: ctx.tenantId,
      ticketId: id,
      at: now,
      loginId: ctx.loginId,
      actingPersonId: personId,
      payload,
    });
    // The guard is inside the append as well: a ticket that changed in between is a 409.
    return event ? { state: 'ok' as const, payload } : { state: 'not-breakdown' as const };
  });
  if (outcome.state === 'ok') {
    reply.code(201).send(outcome.payload);
    return;
  }
  const refusal = outcome.state === 'missing' ? MISSING : NOT_BREAKDOWN;
  reply.code(refusal.status).send(refusal.body);
}

/**
 * PUT /api/v1/tickets/:id/oem-cause: appends one oem_cause event on a closed breakdown of this plant and answers
 * the stored payload with 201. Who decided and the plant date are the session's, never the body's.
 */
export function registerOemCauseRoutes(app: FastifyInstance, pool: Pool): void {
  app.put('/api/v1/tickets/:id/oem-cause', (request, reply) => putOemCause(pool, request, reply));
}
