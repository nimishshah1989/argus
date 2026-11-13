import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError, changePasswordSchema, loginSchema } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { bearerToken, hashToken, newToken } from './session.js';
import { bindLog } from './logging.js';
import { resolveTenant, tenantSlugFromHost } from './tenant.js';
import type { AppConfig } from './config.js';

const PASSWORD_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

interface AuthContext {
  token: string;
  tenantId: string;
  loginId: string;
  username: string;
  role: string;
  shared: boolean;
  personId: string | null;
  personName: string | null;
  personTitle: string | null;
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

export async function requireAuth(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  const token = bearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send(apiError('unauthenticated', 'Missing bearer token'));
    return null;
  }
  const found = (await pool.query('SELECT * FROM auth_lookup($1)', [hashToken(token)])).rows[0];
  if (!found) {
    reply
      .code(401)
      .send(apiError('unauthenticated', 'Your sign-in has ended. Please sign in again.'));
    return null;
  }
  bindLog(request, reply, { tenantId: found.tenant_id, loginId: found.login_id });
  await withTenant(pool, found.tenant_id, (client) =>
    client.query(
      "UPDATE session SET last_seen_at = now(), expires_at = now() + interval '30 days' WHERE token_hash = $1",
      [hashToken(token)],
    ),
  );
  const login = (
    await withTenant(pool, found.tenant_id, (client) =>
      client.query('SELECT id, username, role, shared FROM login WHERE id = $1', [found.login_id]),
    )
  ).rows[0];
  const person = found.acting_person_id
    ? (
        await withTenant(pool, found.tenant_id, (client) =>
          client.query('SELECT id, name, title FROM person WHERE id = $1', [
            found.acting_person_id,
          ]),
        )
      ).rows[0]
    : null;
  if (!login) {
    reply
      .code(401)
      .send(apiError('unauthenticated', 'Your sign-in has ended. Please sign in again.'));
    return null;
  }
  return {
    token,
    tenantId: found.tenant_id,
    loginId: login.id,
    username: login.username,
    role: login.role,
    shared: login.shared,
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    personTitle: person?.title ?? null,
  };
}

async function findLogin(pool: Pool, tenantId: string, username: string) {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query(
        'SELECT id, tenant_id, person_id, password_hash, role, shared, disabled_at FROM login WHERE username = $1',
        [username],
      ),
    )
  ).rows[0];
}

async function findPerson(pool: Pool, tenantId: string, personId: string) {
  return (
    await withTenant(pool, tenantId, (client) =>
      client.query('SELECT id, name, title FROM person WHERE id = $1', [personId]),
    )
  ).rows[0];
}

async function insertSession(
  pool: Pool,
  args: { tenantId: string; loginId: string; device?: string; actingPersonId: string },
): Promise<string> {
  const token = newToken();
  await withTenant(pool, args.tenantId, (client) =>
    client.query(
      "INSERT INTO session (tenant_id, login_id, token_hash, device_label, expires_at, acting_person_id) VALUES ($1, $2, $3, $4, now() + interval '30 days', $5)",
      [args.tenantId, args.loginId, hashToken(token), args.device ?? null, args.actingPersonId],
    ),
  );
  return token;
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
  bindLog(request, reply, { tenantId: tenant.id });
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
  const token = await insertSession(pool, {
    tenantId: tenant.id,
    loginId: loginRow.id,
    device,
    actingPersonId: person.id,
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
  await withTenant(pool, ctx.tenantId, (client) =>
    client.query('UPDATE session SET revoked_at = now() WHERE token_hash = $1', [
      hashToken(ctx.token),
    ]),
  );
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
    const row = (await client.query('SELECT password_hash FROM login WHERE id = $1', [ctx.loginId]))
      .rows[0];
    if (!(await verify(row.password_hash, parsed.data.old))) return false;
    const newHash = await hash(parsed.data.password, PASSWORD_OPTS);
    await client.query('UPDATE login SET password_hash = $1 WHERE id = $2', [newHash, ctx.loginId]);
    await client.query(
      'UPDATE session SET revoked_at = now() WHERE login_id = $1 AND token_hash <> $2',
      [ctx.loginId, hashToken(ctx.token)],
    );
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

export function registerAuth(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/brand', (request, reply) => brand(pool, request, reply));
  app.post('/api/v1/auth/login', (request, reply) => login(pool, request, reply));
  app.get('/api/v1/auth/me', (request, reply) => me(pool, request, reply));
  app.post('/api/v1/auth/logout', (request, reply) => logout(pool, request, reply));
  app.post('/api/v1/auth/password', (request, reply) => changePassword(pool, request, reply));
}
