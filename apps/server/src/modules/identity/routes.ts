import { randomUUID } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError, changePasswordSchema, loginSchema } from '@uptimo/shared';
import { bindLog, withTenant, type AppConfig, type AuthContext } from '../../kernel/index.js';
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
import { createLoginGuard } from './login-guard.js';
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

// An unknown or switched-off username still pays for one password check, so the answer takes as long.
const dummyHash = hashPassword(`not-a-real-password-${randomUUID()}`);
dummyHash.catch(() => undefined);

async function passwordMatches(
  row: { password_hash: string; disabled_at: unknown } | undefined,
  password: string,
): Promise<boolean> {
  const matches = await verify(row?.password_hash ?? (await dummyHash), password);
  return matches && row !== undefined && !row.disabled_at;
}

interface NewSession {
  tenantId: string;
  loginRow: { id: string; role: string; shared: boolean };
  username: string;
  device: string | undefined;
  person: { id: string; name: string; title: string | null };
}

async function startSession(pool: Pool, reply: FastifyReply, n: NewSession) {
  const token = newToken();
  await insertSession(pool, {
    tenantId: n.tenantId,
    loginId: n.loginRow.id,
    device: n.device,
    actingPersonId: n.person.id,
    tokenHash: hashToken(token),
  });
  reply.send({
    token,
    user: {
      id: n.loginRow.id,
      username: n.username,
      name: n.person.name,
      title: n.person.title,
      role: n.loginRow.role,
      shared: n.loginRow.shared,
      actingPersonId: n.person.id,
    },
  });
}

async function login(
  pool: Pool,
  guard: ReturnType<typeof createLoginGuard>,
  request: FastifyRequest,
  reply: FastifyReply,
) {
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
  bindLog(request, reply, { tenantId: tenant.id });
  const { username, password, device, actingPersonId } = parsed.data;
  const wait = guard.take(request.ip, tenant.id, username);
  if (wait > 0) {
    reply
      .code(429)
      .header('retry-after', wait)
      .send(apiError('rate_limited', 'Too many sign-in attempts. Try again in a few minutes'));
    return;
  }
  const loginRow = await findLogin(pool, tenant.id, username);
  const passwordOk = await passwordMatches(loginRow, password);
  if (!loginRow || !passwordOk) {
    reply.code(401).send(apiError('unauthenticated', 'Invalid username or password'));
    return;
  }
  guard.refund(request.ip, tenant.id, username);
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
  await startSession(pool, reply, {
    tenantId: tenant.id,
    loginRow,
    username,
    device,
    person,
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
  const guard = createLoginGuard();
  app.get('/api/v1/brand', (request, reply) => brand(pool, request, reply));
  app.post('/api/v1/auth/login', (request, reply) => login(pool, guard, request, reply));
  app.get('/api/v1/auth/me', (request, reply) => me(pool, request, reply));
  app.post('/api/v1/auth/logout', (request, reply) => logout(pool, request, reply));
  app.post('/api/v1/auth/password', (request, reply) => changePassword(pool, request, reply));
}
