import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import { SlaInputError } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { registerTickets } from './tickets.js';
import { registerTags } from './tags.js';
import type { AppConfig } from './config.js';
import {
  startJobs,
  reconcileTicket,
  type SlaTicketReconciler,
} from './modules/accountability/index.js';
import { registerAuthGuard, registerHealth } from './kernel/index.js';
import { modules } from './modules/index.js';
import { authenticate } from './modules/identity/index.js';

export async function buildApp(config: AppConfig) {
  const reconcileForJobs: SlaTicketReconciler = (client, tenantId, ticketId, now) =>
    reconcileTicket(client, { tenantId, ticketId, now, boss: config.jobBoss });
  const jobs = config.jobBoss
    ? { boss: config.jobBoss, close: config.jobsHandle?.close ?? (async () => undefined) }
    : await startJobs({
        connectionString: config.databaseUrl ?? config.pool.options.connectionString!,
        pool: config.pool,
        role: 'api',
        reconcileTicket: reconcileForJobs,
        onBossReady: (boss) => {
          config.jobBoss = boss;
        },
      });
  config.jobBoss = jobs.boss;
  const app = Fastify({
    logger: config.logger ?? false,
    genReqId: () => randomUUID(),
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  app.addHook('onClose', async () => jobs.close());
  // The guard must stay registered before any route: a route added earlier escapes it.
  registerAuthGuard(app, (token) => authenticate(config.pool, token));
  await app.register(rateLimit, { max: config.rateLimitMax ?? 1000, timeWindow: '1 minute' });
  registerHealth(app, config);
  for (const mod of modules) mod.register(app, config);
  registerTickets(app, config);
  registerTags(app, config);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SlaInputError) {
      reply.code(422).send(apiError('validation', error.message, error.code));
      return;
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      reply.code(429).send(apiError('rate_limited', 'Too many requests'));
      return;
    }
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      const message = error instanceof Error ? error.message : 'Invalid request';
      reply.code(statusCode).send(apiError('validation', message));
      return;
    }
    reply.log.error({ err: error }, 'unhandled error');
    reply.code(500).send(apiError('internal', 'Internal error'));
  });
  return app;
}
