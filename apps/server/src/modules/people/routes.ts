import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { canSettingsPeople } from '@uptimo/domain';
import {
  apiError,
  loginCreateSchema,
  loginPatchSchema,
  personCreateSchema,
  personPatchSchema,
} from '@uptimo/shared';
import {
  fieldProblem,
  idOrNotFound,
  withTenant,
  type AppConfig,
  type AuthContext,
} from '../../kernel/index.js';
import {
  ErasedPersonError,
  ErasureKeyMissing,
  listLoginAdmin,
  listPersonAdmin,
  requireAuth,
} from '../identity/index.js';
import { actorOf, forbidden } from '../plant/index.js';
import { createLogin, patchLogin } from './logins.js';
import type { Actor, Outcome } from './outcome.js';
import { createPerson, patchPerson } from './service.js';

/** The signed-in admin, or null after answering 401 or 403. Everyone else gets 403 on every route here. */
async function adminOnly(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return null;
  if (canSettingsPeople(actorOf(ctx))) return ctx;
  forbidden(reply);
  return null;
}

/** The body as the schema reads it, or a 422 that names the field (sent here), or null. */
function parse<T>(schema: ZodType<T, z.ZodTypeDef, unknown>, body: unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const { status, body: error } = fieldProblem(parsed.error);
  reply.code(status).send(error);
  return null;
}

const CONFLICTS: Record<string, [string, string]> = {
  person_phone_unique: ['phone', 'That number already belongs to another person'],
  login_tenant_id_username_key: ['username', 'That username is taken'],
};

/** A number or username that someone else holds is a 409, not a 500; any other failure is rethrown. */
function conflictOf(error: unknown) {
  const e = error as { code?: string; constraint?: string };
  const hit = e.code === '23505' && e.constraint ? CONFLICTS[e.constraint] : undefined;
  return hit && apiError('conflict', hit[1], hit[0]);
}

async function write<T>(reply: FastifyReply, work: () => Promise<Outcome<T>>): Promise<void> {
  try {
    const out = await work();
    if (out.ok) reply.code(out.status).send(out.value);
    else reply.code(out.status).send(out.error);
  } catch (error) {
    if (error instanceof ErasureKeyMissing) {
      reply
        .code(503)
        .send(apiError('not_configured', 'Creating people is paused until the server is set up'));
      return;
    }
    const conflict =
      error instanceof ErasedPersonError
        ? apiError('conflict', error.message, 'name')
        : conflictOf(error);
    if (!conflict) throw error;
    reply.code(409).send(conflict);
  }
}

const auditActor = (ctx: AuthContext): Actor => ({ tenantId: ctx.tenantId, loginId: ctx.loginId });

export function registerPeopleRoutes(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  const run =
    <T>(ctx: AuthContext, work: (tx: PoolClient) => Promise<Outcome<T>>) =>
    () =>
      withTenant(pool, ctx.tenantId, work);

  const list = (url: string, read: (tx: PoolClient) => Promise<unknown[]>) =>
    app.get(url, async (request, reply) => {
      const ctx = await adminOnly(pool, request, reply);
      if (ctx) reply.send({ items: await withTenant(pool, ctx.tenantId, read), nextCursor: null });
    });
  list('/api/v1/people', listPersonAdmin);
  list('/api/v1/logins', listLoginAdmin);

  const create = <B>(
    url: string,
    schema: ZodType<B, z.ZodTypeDef, unknown>,
    make: (tx: PoolClient, actor: Actor, body: B) => Promise<Outcome<unknown>>,
  ) =>
    app.post(url, async (request, reply) => {
      const ctx = await adminOnly(pool, request, reply);
      const body = ctx && parse(schema, request.body, reply);
      if (ctx && body)
        await write(
          reply,
          run(ctx, (tx) => make(tx, auditActor(ctx), body)),
        );
    });
  create('/api/v1/people', personCreateSchema, createPerson);
  create('/api/v1/logins', loginCreateSchema, createLogin);

  // Edit, switch off and switch on are all this one PUT (`active`): the generated screen never sends DELETE.
  const edit = <B>(
    url: string,
    what: string,
    schema: ZodType<B, z.ZodTypeDef, unknown>,
    change: (
      tx: PoolClient,
      actor: Actor,
      target: { id: string; body: B },
    ) => Promise<Outcome<unknown>>,
  ) =>
    app.put(`${url}/:id`, async (request, reply) => {
      const ctx = await adminOnly(pool, request, reply);
      if (!ctx) return;
      const { id } = request.params as { id: string };
      if (!idOrNotFound(reply, id, what)) return;
      const body = parse(schema, request.body, reply);
      if (body)
        await write(
          reply,
          run(ctx, (tx) => change(tx, auditActor(ctx), { id, body })),
        );
    });
  edit('/api/v1/people', 'person', personPatchSchema, (tx, actor, t) =>
    patchPerson(tx, actor, t.id, t.body),
  );
  edit('/api/v1/logins', 'login', loginPatchSchema, (tx, actor, t) =>
    patchLogin(tx, actor, t.id, t.body),
  );
}
