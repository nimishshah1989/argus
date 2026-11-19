import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { canSeeFailedJobs } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import {
  idOrNotFound,
  jobDb,
  withTenant,
  type AppConfig,
  type AuthContext,
} from '../../kernel/index.js';
import { refuseSupport, requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { actorOf } from '../plant/index.js';

/**
 * Failed background jobs (MILESTONES 78a), read from pg-boss's own table: no table of ours. A job belongs to the
 * plant named in its payload (`tenantId`); a job with none (a nightly sweep over every plant) is not shown to any
 * plant. The admin on a personal login lists them and retries one; the retry is on the audit trail.
 */

const LIST = '/api/v1/jobs/failed';
const SHOWN = 100;
const MAX_ERROR = 300;

interface FailedJob {
  id: string;
  queue: string;
  error: string;
  attempts: number;
  createdAt: string;
  failedAt: string | null;
}

/** pg-boss keeps a failure's output as `{ message, ... }`; only the message leaves, never a stack. */
function errorOf(output: unknown): string {
  const message = (output as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message.slice(0, MAX_ERROR) : 'No message was kept';
}

async function failedJobs(pool: Pool, tenantId: string, id?: string): Promise<FailedJob[]> {
  const { rows } = await pool.query(
    `SELECT id, name, output, retry_count, created_on, completed_on FROM pgboss.job
      WHERE state = 'failed' AND data->>'tenantId' = $1 AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY completed_on DESC NULLS LAST LIMIT ${SHOWN}`,
    [tenantId, id ?? null],
  );
  return rows.map((row) => ({
    id: row.id as string,
    queue: row.name as string,
    error: errorOf(row.output),
    attempts: (row.retry_count as number) + 1,
    createdAt: (row.created_on as Date).toISOString(),
    failedAt: row.completed_on ? (row.completed_on as Date).toISOString() : null,
  }));
}

async function caller(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx || refuseSupport(ctx, reply)) return null;
  if (canSeeFailedJobs(actorOf(ctx))) return ctx;
  void reply.code(403).send(apiError('forbidden', 'You do not have permission for this action'));
  return null;
}

async function retry(config: AppConfig, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await caller(config.pool, request, reply);
  if (!ctx) return;
  const { id } = request.params as { id: string };
  if (!idOrNotFound(reply, id, 'job')) return;
  const [job] = await failedJobs(config.pool, ctx.tenantId, id);
  if (!job || !config.jobBoss)
    return void reply.code(404).send(apiError('not_found', 'Unknown failed job', 'id'));
  const boss = config.jobBoss;
  // The retry and its audit line are one transaction; a second click finds the job no longer failed and answers 404.
  const retried = await withTenant(config.pool, ctx.tenantId, async (client) => {
    const result = await boss.retry(job.queue, id, { db: jobDb(client) });
    if (result.affected === 0) return false;
    await audit.record(client, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      action: 'job.retry',
      entity: 'job',
      entityId: id,
      before: { queue: job.queue, error: job.error },
      after: { retried: true },
    });
    return true;
  });
  if (!retried) return void reply.code(404).send(apiError('not_found', 'Unknown failed job', 'id'));
  reply.send({ ok: true });
}

export function registerFailedJobRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get(LIST, async (request, reply) => {
    const ctx = await caller(config.pool, request, reply);
    if (ctx) reply.send({ items: await failedJobs(config.pool, ctx.tenantId) });
  });
  app.post(`${LIST}/:id/retry`, (request, reply) => retry(config, request, reply));
}
