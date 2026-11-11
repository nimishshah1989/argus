import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { apiError, isTagCategory, tagApplySchema } from '@uptimo/shared';
import { canWork, type Role } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { requireAuth } from './auth.js';
import type { AppConfig } from './config.js';
import * as idem from './ticket-idempotency.js';
import { loadTicketRow } from './ticket-sql.js';
import {
  addAssignment,
  appendTagEvent,
  findDefinition,
  listCatalogue,
  loadTicketTags,
  removeAssignment,
  ticketExists,
} from './tag-sql.js';

type Auth = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
type Outcome = { status: number; body: unknown };
interface TagMutation {
  operation: 'add' | 'remove';
  ticketId: string;
  tagId: string;
  binding: idem.IdempotencyBinding;
}

async function catalogue(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  category?: string,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (category !== undefined && !isTagCategory(category)) {
    reply.code(404).send(apiError('not_found', 'Unknown tag category'));
    return;
  }
  const tags = await withTenant(pool, ctx.tenantId, (client) =>
    listCatalogue(client, ctx.tenantId, category),
  );
  reply.send({ tags });
}

function keyOrReply(request: FastifyRequest, reply: FastifyReply): string | null {
  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply
      .code(422)
      .send(apiError('validation', 'Idempotency-Key header is required', 'idempotencyKey'));
  }
  return key;
}

async function getTicketTags(client: PoolClient, auth: Auth, ticketId: string): Promise<Outcome> {
  if (!(await ticketExists(client, auth.tenantId, ticketId))) {
    return { status: 404, body: apiError('not_found', 'Ticket not found') };
  }
  return { status: 200, body: await loadTicketTags(client, auth.tenantId, ticketId) };
}

async function addTag(client: PoolClient, auth: Auth, input: TagMutation): Promise<Outcome> {
  const { ticketId, tagId, binding } = input;
  const ticket = await loadTicketRow(client, ticketId, auth.tenantId);
  if (!ticket) return { status: 404, body: apiError('not_found', 'Ticket not found') };
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  const definition = await findDefinition(client, auth.tenantId, tagId);
  if (!definition?.active) {
    return {
      status: 422,
      body: apiError('validation', 'Unknown or inactive tag', 'tagId'),
    };
  }
  const added = await addAssignment(client, {
    tenantId: auth.tenantId,
    ticketId,
    itemId: tagId,
    loginId: auth.loginId,
    personId: auth.personId,
  });
  if (added) {
    await appendTagEvent(client, {
      tenantId: auth.tenantId,
      ticketId,
      sequence: (ticket.last_event_seq as number) + 1,
      key: binding.key,
      loginId: auth.loginId,
      personId: auth.personId,
      type: 'tag_add',
      definition,
    });
  }
  const outcome = { status: 200, body: await loadTicketTags(client, auth.tenantId, ticketId) };
  await idem.storeIdempotent(client, { ...binding, command: 'tag:add', result: outcome });
  return outcome;
}

async function removeTag(client: PoolClient, auth: Auth, input: TagMutation): Promise<Outcome> {
  const { ticketId, tagId, binding } = input;
  const ticket = await loadTicketRow(client, ticketId, auth.tenantId);
  if (!ticket) return { status: 404, body: apiError('not_found', 'Ticket not found') };
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  const definition = await findDefinition(client, auth.tenantId, tagId);
  const removed = await removeAssignment(client, auth.tenantId, ticketId, tagId);
  if (removed && definition) {
    await appendTagEvent(client, {
      tenantId: auth.tenantId,
      ticketId,
      sequence: (ticket.last_event_seq as number) + 1,
      key: binding.key,
      loginId: auth.loginId,
      personId: auth.personId,
      type: 'tag_remove',
      definition,
    });
  }
  const outcome = { status: 200, body: await loadTicketTags(client, auth.tenantId, ticketId) };
  await idem.storeIdempotent(client, { ...binding, command: 'tag:remove', result: outcome });
  return outcome;
}

async function execute(pool: Pool, auth: Auth, input: TagMutation): Promise<Outcome> {
  try {
    return await withTenant(pool, auth.tenantId, (client) =>
      input.operation === 'add' ? addTag(client, auth, input) : removeTag(client, auth, input),
    );
  } catch (error) {
    if (error instanceof idem.IdempotencyKeyReusedError) return idem.reusedKeyOutcome();
    if (!idem.isUniqueViolation(error)) throw error;
    try {
      const stored = await withTenant(pool, auth.tenantId, (client) =>
        idem.getIdempotent(client, input.binding),
      );
      return stored ?? { status: 500, body: apiError('internal', 'Internal error') };
    } catch (lookupError) {
      if (lookupError instanceof idem.IdempotencyKeyReusedError) return idem.reusedKeyOutcome();
      throw lookupError;
    }
  }
}

async function mutate(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  operation: 'add' | 'remove',
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWork({ ...ctx, role: ctx.role as Role })) {
    reply.code(403).send(apiError('forbidden', 'You do not have permission to edit ticket tags'));
    return;
  }
  const key = keyOrReply(request, reply);
  if (!key) return;
  const params = request.params as { id: string; tagId?: string };
  const candidate = {
    tagId: operation === 'add' ? (request.body as { tagId?: unknown } | null)?.tagId : params.tagId,
  };
  const parsed = tagApplySchema.safeParse(candidate);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'A valid tagId is required', 'tagId'));
    return;
  }
  const command = operation === 'add' ? 'tag:add' : 'tag:remove';
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    command,
    { ticketId: params.id, tagId: parsed.data.tagId },
  ]);
  const outcome = await execute(pool, ctx, {
    operation,
    ticketId: params.id,
    tagId: parsed.data.tagId,
    binding,
  });
  reply.code(outcome.status).send(outcome.body);
}

export function registerTags(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/tags', (request, reply) => catalogue(pool, request, reply));
  app.get<{ Params: { category: string } }>('/api/v1/tags/:category', (request, reply) =>
    catalogue(pool, request, reply, request.params.category),
  );
  app.get<{ Params: { id: string } }>('/api/v1/tickets/:id/tags', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const outcome = await withTenant(pool, ctx.tenantId, (client) =>
      getTicketTags(client, ctx, request.params.id),
    );
    reply.code(outcome.status).send(outcome.body);
  });
  app.post<{ Params: { id: string } }>('/api/v1/tickets/:id/tags', (request, reply) =>
    mutate(pool, request, reply, 'add'),
  );
  app.delete<{ Params: { id: string; tagId: string } }>(
    '/api/v1/tickets/:id/tags/:tagId',
    (request, reply) => mutate(pool, request, reply, 'remove'),
  );
}
