import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { canExportAudit, canReadAudit, type ActorContext } from '@uptimo/domain';
import {
  apiError,
  auditExportQuerySchema,
  auditQuerySchema,
  isUuid,
  type AuditExportQuery,
  type AuditQuery,
} from '@uptimo/shared';
import {
  fieldProblem,
  refuse,
  withTenant,
  type AuthContext,
  type Refusal,
} from '../../kernel/index.js';
import { audit, type AuditPageRow } from '../ops/index.js';
import { loginNames, loginsOfPerson } from './repo/people.js';
import { tenantInfo } from './repo.js';
import { requireAuth } from './service.js';
import { auditCsv } from './audit-csv.js';

/**
 * The audit screen's read side (MILESTONES 20 goal 2): the page an admin and the head read, and the CSV only the
 * admin exports. `audit_log` is read through the `ops` module's published `audit.page`; names live here, so this
 * module (which may call `ops`) shapes the reply instead of `ops` reaching up to `login`/`person`.
 */

const PAGE = '/api/v1/audit';
const CSV = '/api/v1/audit.csv';
/** The export is bounded: half a hundred thousand lines, then one comment says it was cut. */
export const EXPORT_CAP = 50_000;

const actorOf = (ctx: AuthContext): ActorContext => ({
  role: ctx.role as ActorContext['role'],
  loginId: ctx.loginId,
  personId: ctx.personId,
  shared: ctx.shared,
});

const forbidden = (reply: FastifyReply): void =>
  void reply.code(403).send(apiError('forbidden', 'You do not have permission for this action'));

/** The signed-in caller, or null after answering 401 or 403 for a role outside the audit cell. */
async function caller(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return null;
  if (canReadAudit(actorOf(ctx))) return ctx;
  forbidden(reply);
  return null;
}

const encodeCursor = (at: string, id: string): string =>
  Buffer.from(`${at}|${id}`, 'utf8').toString('base64url');

/** The place a page ended, null for the first page, or undefined when the cursor is not one of ours. */
function decodeCursor(cursor: string | undefined): { at: string; id: string } | null | undefined {
  if (!cursor) return null;
  const [at = '', id = ''] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return isUuid(id) && !Number.isNaN(Date.parse(at)) ? { at, id } : undefined;
}

/** A range that runs backwards names the field it starts from. */
function rangeProblem(query: { from?: string; to?: string }): Refusal | null {
  return query.from && query.to && query.from > query.to
    ? refuse(422, 'validation', 'from is after to', 'from')
    : null;
}

/** One archive page's rows, plus the display name of every login among them. */
interface Fetched {
  rows: AuditPageRow[];
  names: Map<string, string>;
}

async function fetch(
  tx: PoolClient,
  page: {
    tenantId: string;
    query: AuditQuery | AuditExportQuery;
    cursor: { at: string; id: string } | null;
    limit: number;
  },
): Promise<Fetched> {
  const { tenantId, query, cursor, limit } = page;
  const { time_zone: timeZone } = await tenantInfo(tx, tenantId);
  const loginIds = query.personId
    ? (await loginsOfPerson(tx, query.personId)).map((login) => login.id)
    : [];
  const rows = await audit.page(tx, {
    tenantId,
    area: query.area,
    personId: query.personId,
    loginIds,
    from: query.from,
    to: query.to,
    timeZone,
    cursor,
    limit,
  });
  const named = rows.flatMap((row) => (row.loginId ? [row.loginId] : []));
  return { rows, names: await loginNames(tx, [...new Set(named)]) };
}

const item = (row: AuditPageRow, names: Map<string, string>) => ({
  id: row.id,
  at: row.at.toISOString(),
  action: row.action,
  entity: row.entity,
  entityId: row.entityId,
  actor: row.loginId ? { loginId: row.loginId, name: names.get(row.loginId) ?? '' } : null,
  before: row.before,
  after: row.after,
  ip: row.ip,
});

async function readPage(
  pool: Pool,
  ctx: AuthContext,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = auditQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    return void reply.code(status).send(body);
  }
  const query = parsed.data;
  const range = rangeProblem(query);
  if (range) return void reply.code(range.status).send(range.body);
  const cursor = decodeCursor(query.cursor);
  if (cursor === undefined)
    return void reply.code(422).send(apiError('validation', 'Invalid cursor', 'cursor'));
  const page = await withTenant(pool, ctx.tenantId, async (tx) => {
    const { rows, names } = await fetch(tx, {
      tenantId: ctx.tenantId,
      query,
      cursor,
      limit: query.limit,
    });
    const shown = rows.slice(0, query.limit);
    const last = shown[shown.length - 1];
    return {
      items: shown.map((row) => item(row, names)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.atKey, last.id) : null,
    };
  });
  reply.send(page);
}

async function exportCsv(
  pool: Pool,
  ctx: AuthContext,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!canExportAudit(actorOf(ctx))) return forbidden(reply);
  const parsed = auditExportQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    const { status, body } = fieldProblem(parsed.error);
    return void reply.code(status).send(body);
  }
  const range = rangeProblem(parsed.data);
  if (range) return void reply.code(range.status).send(range.body);
  const body = await withTenant(pool, ctx.tenantId, async (tx) => {
    const { rows, names } = await fetch(tx, {
      tenantId: ctx.tenantId,
      query: parsed.data,
      cursor: null,
      limit: EXPORT_CAP,
    });
    const capped = rows.length > EXPORT_CAP;
    const shown = capped ? rows.slice(0, EXPORT_CAP) : rows;
    return auditCsv(
      shown.map((row) => ({
        at: row.at.toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        actor: row.loginId ? (names.get(row.loginId) ?? '') : null,
        ip: row.ip,
        before: row.before,
        after: row.after,
      })),
      capped ? EXPORT_CAP : null,
    );
  });
  reply.header('content-type', 'text/csv; charset=utf-8');
  reply.header('content-disposition', 'attachment; filename="audit.csv"');
  reply.send(body);
}

export function registerAuditRoutes(app: FastifyInstance, pool: Pool): void {
  app.get(PAGE, async (request, reply) => {
    const ctx = await caller(pool, request, reply);
    if (ctx) await readPage(pool, ctx, request, reply);
  });
  app.get(CSV, async (request, reply) => {
    const ctx = await caller(pool, request, reply);
    if (ctx) await exportCsv(pool, ctx, request, reply);
  });
}
