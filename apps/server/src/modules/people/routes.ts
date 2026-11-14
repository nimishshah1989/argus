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
import { withTenant, type AppConfig, type AuthContext } from '../../kernel/index.js';
import { listLoginAdmin, listPersonAdmin, requireAuth } from '../identity/index.js';
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

function parse<T>(schema: ZodType<T, z.ZodTypeDef, unknown>, body: unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join('.') || undefined;
  reply.code(422).send(apiError('validation', issue?.message ?? 'Invalid request', field));
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

async function write<T>(
  reply: FastifyReply,
  work: () => Promise<Outcome<T>>,
  key: string,
): Promise<void> {
  try {
    const out = await work();
    if (out.ok) reply.code(out.status).send({ [key]: out.value });
    else reply.code(out.status).send(out.error);
  } catch (error) {
    const conflict = conflictOf(error);
    if (!conflict) throw error;
    reply.code(409).send(conflict);
  }
}

const auditActor = (ctx: AuthContext): Actor => ({ tenantId: ctx.tenantId, loginId: ctx.loginId });
const uuid = z.string().uuid();

function unknownId(reply: FastifyReply, what: string): void {
  reply.code(404).send(apiError('not_found', `Unknown ${what}`));
}

export function registerPeopleRoutes(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  const run =
    <T>(ctx: AuthContext, work: (tx: PoolClient) => Promise<Outcome<T>>) =>
    () =>
      withTenant(pool, ctx.tenantId, work);

  const list = (url: string, key: string, read: (tx: PoolClient) => Promise<unknown>) =>
    app.get(url, async (request, reply) => {
      const ctx = await adminOnly(pool, request, reply);
      if (ctx) reply.send({ [key]: await withTenant(pool, ctx.tenantId, read) });
    });
  list('/api/v1/people', 'people', listPersonAdmin);
  list('/api/v1/logins', 'logins', listLoginAdmin);

  app.post('/api/v1/people', async (request, reply) => {
    const ctx = await adminOnly(pool, request, reply);
    const body = ctx && parse(personCreateSchema, request.body, reply);
    if (!ctx || !body) return;
    await write(
      reply,
      run(ctx, (tx) => createPerson(tx, auditActor(ctx), body)),
      'person',
    );
  });

  app.patch('/api/v1/people/:id', async (request, reply) => {
    const ctx = await adminOnly(pool, request, reply);
    const body = ctx && parse(personPatchSchema, request.body, reply);
    if (!ctx || !body) return;
    const id = uuid.safeParse((request.params as { id: string }).id);
    if (!id.success) return unknownId(reply, 'person');
    await write(
      reply,
      run(ctx, (tx) => patchPerson(tx, auditActor(ctx), id.data, body)),
      'person',
    );
  });

  app.post('/api/v1/logins', async (request, reply) => {
    const ctx = await adminOnly(pool, request, reply);
    const body = ctx && parse(loginCreateSchema, request.body, reply);
    if (!ctx || !body) return;
    await write(
      reply,
      run(ctx, (tx) => createLogin(tx, auditActor(ctx), body)),
      'login',
    );
  });

  app.patch('/api/v1/logins/:id', async (request, reply) => {
    const ctx = await adminOnly(pool, request, reply);
    const body = ctx && parse(loginPatchSchema, request.body, reply);
    if (!ctx || !body) return;
    const id = uuid.safeParse((request.params as { id: string }).id);
    if (!id.success) return unknownId(reply, 'login');
    await write(
      reply,
      run(ctx, (tx) => patchLogin(tx, auditActor(ctx), id.data, body)),
      'login',
    );
  });
}
