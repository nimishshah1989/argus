import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { canManageSupportAccess, type ActorContext } from '@uptimo/domain';
import {
  apiError,
  isUuid,
  supportAccessCreateSchema,
  supportActionsQuerySchema,
} from '@uptimo/shared';
import { fieldProblem, idOrNotFound, withTenant, type AuthContext } from '../../kernel/index.js';
import { audit } from '../ops/index.js';
import { endGrant, grantById, insertGrant, listGrants, type GrantRow } from './repo/support.js';
import { refuseSupport, requireAuth } from './service.js';

/**
 * The customer's side of support access (D27): the admin approves a few days for one named member of our staff,
 * sees every call made under it, and can end it. Our own staff can use none of these routes.
 */

const ENTITY = 'platform_access';
const WHAT = 'support access';

/** The plant's own admin on a personal login, or null after answering 401 or 403. */
async function manager(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx || refuseSupport(ctx, reply)) return null;
  const { loginId, personId, shared } = ctx;
  const role = ctx.role as ActorContext['role'];
  if (canManageSupportAccess({ role, loginId, personId, shared })) return ctx;
  reply.code(403).send(apiError('forbidden', 'You do not have permission for this action'));
  return null;
}

const notFound = (reply: FastifyReply) =>
  reply.code(404).send(apiError('not_found', `Unknown ${WHAT}`, 'id'));

const grantReply = (row: Omit<GrantRow, 'live' | 'approved_by_login_id'>) => ({
  id: row.id,
  platformUser: row.platform_user,
  reason: row.reason,
  createdAt: row.created_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  approvedBy: row.approved_by,
});

async function approve(pool: Pool, ctx: AuthContext, request: FastifyRequest, reply: FastifyReply) {
  const parsed = supportAccessCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    return reply.code(status).send(body);
  }
  const { platformUser, reason, days } = parsed.data;
  const approver = { loginId: ctx.loginId, username: ctx.username };
  const made = await withTenant(pool, ctx.tenantId, async (tx) => {
    const row = await insertGrant(tx, {
      tenantId: ctx.tenantId,
      platformUser,
      reason,
      days,
      approver,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      action: 'support_access.grant',
      entity: ENTITY,
      entityId: row.id,
      before: null,
      after: { platformUser, reason, expiresAt: row.expires_at },
    });
    return row;
  });
  const grant = { ...made, platform_user: platformUser, reason, approved_by: ctx.username };
  return reply.code(201).send(grantReply(grant));
}

async function list(pool: Pool, ctx: AuthContext, reply: FastifyReply) {
  const rows = await withTenant(pool, ctx.tenantId, (tx) => listGrants(tx, ctx.tenantId));
  const items = rows.map((row) => ({ ...grantReply(row), status: row.live ? 'active' : 'ended' }));
  return reply.send({ items });
}

async function end(pool: Pool, ctx: AuthContext, id: string, reply: FastifyReply) {
  const endedAt = await withTenant(pool, ctx.tenantId, async (tx) => {
    const at = await endGrant(tx, ctx.tenantId, id);
    if (at)
      await audit.record(tx, {
        tenantId: ctx.tenantId,
        loginId: ctx.loginId,
        action: 'support_access.revoke',
        entity: ENTITY,
        entityId: id,
        before: null,
        after: { expiresAt: at },
      });
    return at;
  });
  return endedAt ? reply.send({ ok: true }) : notFound(reply);
}

const encodeCursor = (at: string, id: string): string =>
  Buffer.from(`${at}|${id}`, 'utf8').toString('base64url');

/** The place a page ended, null for the first page, or undefined when the cursor is not one of ours. */
function decodeCursor(cursor: string | undefined): { at: string; id: string } | null | undefined {
  if (!cursor) return null;
  const [at = '', id = ''] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return isUuid(id) && !Number.isNaN(Date.parse(at)) ? { at, id } : undefined;
}

interface ActionsQuery {
  ctx: AuthContext;
  grantId: string;
  query: unknown;
}

async function actions(pool: Pool, { ctx, grantId, query }: ActionsQuery, reply: FastifyReply) {
  const parsed = supportActionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    return reply.code(status).send(body);
  }
  const { limit } = parsed.data;
  const cursor = decodeCursor(parsed.data.cursor);
  if (cursor === undefined)
    return reply.code(422).send(apiError('validation', 'Invalid cursor', 'cursor'));
  const { tenantId } = ctx;
  const rows = await withTenant(pool, tenantId, async (tx) =>
    (await grantById(tx, tenantId, grantId))
      ? audit.supportCalls(tx, { tenantId, grantId, limit, cursor })
      : null,
  );
  if (!rows) return notFound(reply);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return reply.send({
    items: page.map(({ id, at, kind, method, route, ip }) => ({
      id,
      at: at.toISOString(),
      kind,
      method,
      route,
      ip,
    })),
    nextCursor: rows.length > limit && last ? encodeCursor(last.atKey, last.id) : null,
  });
}

export function registerSupportRoutes(app: FastifyInstance, pool: Pool): void {
  const url = '/api/v1/support-access';
  app.post(url, async (request, reply) => {
    const ctx = await manager(pool, request, reply);
    if (ctx) await approve(pool, ctx, request, reply);
  });
  app.get(url, async (request, reply) => {
    const ctx = await manager(pool, request, reply);
    if (ctx) await list(pool, ctx, reply);
  });
  app.delete(`${url}/:id`, async (request, reply) => {
    const ctx = await manager(pool, request, reply);
    const { id } = request.params as { id: string };
    if (ctx && idOrNotFound(reply, id, WHAT)) await end(pool, ctx, id, reply);
  });
  app.get(`${url}/:id/actions`, async (request, reply) => {
    const ctx = await manager(pool, request, reply);
    const { id: grantId } = request.params as { id: string };
    if (ctx && idOrNotFound(reply, grantId, WHAT))
      await actions(pool, { ctx, grantId, query: request.query }, reply);
  });
}
