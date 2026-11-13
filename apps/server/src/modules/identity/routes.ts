import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError, changePasswordSchema, loginSchema } from '@uptimo/shared';
import { withTenant, type AppConfig, type AuthContext } from '../../kernel/index.js';
import {
  findLogin,
  findPerson,
  insertSession,
  passwordHashOf,
  resolveTenant,
  revokeOtherSessions,
  revokeSession,
  setPasswordHash,
} from './repo.js';
import { hashToken, newToken, requireAuth, tenantSlugFromHost } from './service.js';

const PASSWORD_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_OPTS);
}

function userFrom(ctx: AuthContext) {
  return {
    id: ctx.loginId,
    username: ctx.username,
    name: ctx.personName,
    title: ctx.personTitle,
    role: ctx.role,
    shared: ctx.shared,
    actingPersonId: ctx.personId,
  };
}

async function login(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(apiError('validation', 'Invalid request', field));
    return;
  }
  const slug = tenantSlugFromHost(request.headers.host ?? '');
  const tenant = slug ? await resolveTenant(pool, slug) : null;
  if (!tenant) {
    reply.code(404).send(apiError('not_found', 'Unknown company'));
    return;
  }
  const { username, password, device, actingPersonId } = parsed.data;
  const loginRow = await findLogin(pool, tenant.id, username);
  const passwordOk =
    loginRow && !loginRow.disabled_at && (await verify(loginRow.password_hash, password));
  if (!passwordOk) {
    reply.code(401).send(apiError('unauthenticated', 'Invalid username or password'));
    return;
  }
  let acting = loginRow.person_id;
  if (loginRow.shared) {
    if (!actingPersonId) {
      reply.code(422).send(apiError('validation', 'Choose your name', 'actingPersonId'));
      return;
    }
    acting = actingPersonId;
  }
  const person = await findPerson(pool, tenant.id, acting);
  if (!person) {
    reply.code(422).send(apiError('validation', 'Choose your name', 'actingPersonId'));
    return;
  }
  const token = newToken();
  await insertSession(pool, {
    tenantId: tenant.id,
    loginId: loginRow.id,
    device,
    actingPersonId: person.id,
    tokenHash: hashToken(token),
  });
  reply.send({
    token,
    user: {
      id: loginRow.id,
      username,
      name: person.name,
      title: person.title,
      role: loginRow.role,
      shared: loginRow.shared,
      actingPersonId: person.id,
    },
  });
}

async function me(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  reply.send({ user: userFrom(ctx) });
}

async function logout(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  await revokeSession(pool, ctx.tenantId, hashToken(ctx.token));
  reply.send({ ok: true });
}

async function changePassword(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const parsed = changePasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply
      .code(422)
      .send(apiError('validation', 'The new password needs at least 8 characters', field));
    return;
  }
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const ok = await withTenant(pool, ctx.tenantId, async (client) => {
    if (!(await verify(await passwordHashOf(client, ctx.loginId), parsed.data.old))) return false;
    const newHash = await hashPassword(parsed.data.password);
    await setPasswordHash(client, ctx.loginId, newHash);
    await revokeOtherSessions(client, ctx.loginId, hashToken(ctx.token));
    return true;
  });
  if (!ok) {
    reply.code(401).send(apiError('unauthenticated', 'Current password is incorrect'));
    return;
  }
  reply.send({ ok: true });
}

async function brand(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const slug = tenantSlugFromHost(request.headers.host ?? '');
  const tenant = slug ? await resolveTenant(pool, slug) : null;
  if (!tenant) {
    reply.code(404).send(apiError('not_found', 'Unknown company'));
    return;
  }
  reply.send({ company: tenant.name, logo: null });
}

export function registerIdentityRoutes(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/brand', (request, reply) => brand(pool, request, reply));
  app.post('/api/v1/auth/login', (request, reply) => login(pool, request, reply));
  app.get('/api/v1/auth/me', (request, reply) => me(pool, request, reply));
  app.post('/api/v1/auth/logout', (request, reply) => logout(pool, request, reply));
  app.post('/api/v1/auth/password', (request, reply) => changePassword(pool, request, reply));
}
