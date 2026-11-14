import { randomUUID } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { passwordProblem } from '@uptimo/domain';
import { actingPersonSchema, apiError, changePasswordSchema, loginSchema } from '@uptimo/shared';
import { bindLog, withTenant, type AppConfig, type AuthContext } from '../../kernel/index.js';
import {
  findLogin,
  findPerson,
  insertSession,
  passwordHashOf,
  resolveTenant,
  revokeOtherSessions,
  revokeSession,
  setActingPerson,
  setPasswordHash,
} from './repo.js';
import { createLoginGuard } from './login-guard.js';
import { actingTeams, listActingChoices } from './repo/acting.js';
import { tenantLogoId } from './repo/profile.js';
import {
  hashToken,
  newToken,
  passwordMessage,
  requireAuth,
  tenantSlugFromHost,
} from './service.js';

const PASSWORD_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_OPTS);
}

function userFrom(ctx: Omit<AuthContext, 'token' | 'tenantId'>) {
  return {
    id: ctx.loginId,
    username: ctx.username,
    name: ctx.personName ?? '',
    title: ctx.personTitle,
    role: ctx.role,
    shared: ctx.shared,
    actingPersonId: ctx.personId ?? '',
    actingPerson: ctx.personId
      ? { id: ctx.personId, name: ctx.personName ?? '', title: ctx.personTitle }
      : null,
    mustChangePassword: ctx.mustChangePassword,
  };
}

// An unknown, switched-off or erased login still pays for one password check, so the answer takes as long.
const dummyHash = hashPassword(`not-a-real-password-${randomUUID()}`);
dummyHash.catch(() => undefined);

async function passwordMatches(
  row: { password_hash: string; disabled_at: unknown } | undefined,
  password: string,
): Promise<boolean> {
  // An erased login keeps a placeholder instead of a hash, which `verify` rejects by throwing.
  const own = row?.password_hash.startsWith('$argon2') ? row.password_hash : undefined;
  const matches = await verify(own ?? (await dummyHash), password);
  return matches && own !== undefined && !row?.disabled_at;
}

type LoginGuard = ReturnType<typeof createLoginGuard>;

/** Counts this attempt; if the sender must wait, answers 429 and returns true. */
function tooManyAttempts(
  guard: LoginGuard,
  request: FastifyRequest,
  reply: FastifyReply,
  who: { tenantId: string; username: string },
): boolean {
  const wait = guard.take(request.ip, who.tenantId, who.username);
  if (wait <= 0) return false;
  reply
    .code(429)
    .header('retry-after', wait)
    .send(apiError('rate_limited', 'Too many attempts. Try again in a few minutes'));
  return true;
}

interface NewSession {
  tenantId: string;
  loginRow: {
    id: string;
    role: string;
    shared: boolean;
    must_change_password: boolean;
    password_hash: string;
  };
  username: string;
  device: string | undefined;
  /** null on a shared phone that has not yet been told who is using it. */
  person: { id: string; name: string; title: string | null } | null;
}

async function startSession(pool: Pool, reply: FastifyReply, n: NewSession) {
  const token = newToken();
  const started = await insertSession(pool, {
    tenantId: n.tenantId,
    loginId: n.loginRow.id,
    passwordHash: n.loginRow.password_hash,
    device: n.device,
    actingPersonId: n.person?.id ?? null,
    ...(n.loginRow.shared ? { teams: actingTeams(n.loginRow.role) } : {}),
    tokenHash: hashToken(token),
  });
  if (!started) {
    reply.code(401).send(apiError('unauthenticated', 'Invalid username or password'));
    return;
  }
  reply.send({
    token,
    user: userFrom({
      loginId: n.loginRow.id,
      username: n.username,
      role: n.loginRow.role,
      shared: n.loginRow.shared,
      personId: n.person?.id ?? null,
      personName: n.person?.name ?? null,
      personTitle: n.person?.title ?? null,
      mustChangePassword: n.loginRow.must_change_password,
    }),
  });
}

/**
 * Who is signing in: the login's own person, or the one chosen on a shared login (null when none is chosen yet,
 * the app asks next); undefined when the person is unknown or switched off.
 */
async function actingPerson(
  pool: Pool,
  tenantId: string,
  row: { shared: boolean; person_id: string | null; role: string },
  chosen?: string,
) {
  const id = row.shared ? chosen : row.person_id;
  if (!id) return row.shared ? null : undefined;
  const person = await findPerson(pool, tenantId, id);
  if (row.shared && person && !actingTeams(row.role).includes(person.team)) return undefined;
  return person?.active ? person : undefined;
}

async function login(pool: Pool, guard: LoginGuard, request: FastifyRequest, reply: FastifyReply) {
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
  if (tooManyAttempts(guard, request, reply, { tenantId: tenant.id, username })) return;
  const loginRow = await findLogin(pool, tenant.id, username);
  const passwordOk = await passwordMatches(loginRow, password);
  if (!loginRow || !passwordOk) {
    reply.code(401).send(apiError('unauthenticated', 'Invalid username or password'));
    return;
  }
  guard.refund(request.ip, tenant.id, username);
  const person = await actingPerson(pool, tenant.id, loginRow, actingPersonId);
  if (person === undefined) {
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

async function chooseActing(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!ctx.shared) {
    reply.code(403).send(apiError('forbidden', 'Only a shared phone chooses who is using it'));
    return;
  }
  const parsed = actingPersonSchema.safeParse(request.body);
  const chosen =
    parsed.success &&
    (await setActingPerson(pool, {
      tenantId: ctx.tenantId,
      tokenHash: hashToken(ctx.token),
      personId: parsed.data.actingPersonId,
    }));
  if (!chosen) {
    reply.code(422).send(apiError('validation', 'Choose your name', 'actingPersonId'));
    return;
  }
  reply.send({ ok: true });
}

/** The people this shared phone may choose from: the same rule `POST /auth/acting` checks, names and teams only. */
async function actingChoices(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!ctx.shared) {
    reply.code(403).send(apiError('forbidden', 'Only a shared phone chooses who is using it'));
    return;
  }
  reply.send({ people: await listActingChoices(pool, ctx.tenantId, ctx.role) });
}

async function logout(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  await revokeSession(pool, ctx.tenantId, hashToken(ctx.token));
  reply.send({ ok: true });
}

async function changePassword(
  pool: Pool,
  guard: LoginGuard,
  request: FastifyRequest,
  reply: FastifyReply,
) {
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
  const problem = passwordProblem(parsed.data.password, ctx.username);
  if (problem) {
    reply.code(422).send(apiError('validation', passwordMessage(problem), 'password'));
    return;
  }
  // Guessing the old password from a stolen session is limited like guessing at sign-in.
  if (tooManyAttempts(guard, request, reply, ctx)) return;
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
  guard.refund(request.ip, ctx.tenantId, ctx.username);
  reply.send({ ok: true });
}

async function brand(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const slug = tenantSlugFromHost(request.headers.host ?? '');
  const tenant = slug ? await resolveTenant(pool, slug) : null;
  if (!tenant) {
    reply.code(404).send(apiError('not_found', 'Unknown company'));
    return;
  }
  // The file id in the address makes a browser fetch the new logo as soon as one is uploaded.
  const logoId = await tenantLogoId(pool, tenant.slug);
  const logo = logoId ? `/api/v1/brand/logo?v=${logoId}` : null;
  reply.send({ company: tenant.name, logo });
}

export function registerIdentityRoutes(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  const guard = createLoginGuard();
  app.get('/api/v1/brand', (request, reply) => brand(pool, request, reply));
  // Its own request cap per visitor, tighter than the whole API's; an explicit rateLimitMax overrides it.
  const loginCap = { rateLimit: { max: config.rateLimitMax ?? 60, timeWindow: '1 minute' } };
  app.post('/api/v1/auth/login', { config: loginCap }, (request, reply) =>
    login(pool, guard, request, reply),
  );
  app.get('/api/v1/auth/me', (request, reply) => me(pool, request, reply));
  app.get('/api/v1/auth/acting', (request, reply) => actingChoices(pool, request, reply));
  app.post('/api/v1/auth/acting', (request, reply) => chooseActing(pool, request, reply));
  app.post('/api/v1/auth/logout', (request, reply) => logout(pool, request, reply));
  app.post('/api/v1/auth/password', (request, reply) =>
    changePassword(pool, guard, request, reply),
  );
}
