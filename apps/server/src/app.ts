import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { SlaInputError } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { registerReports } from './reports.js';
import { registerSettings } from './settings.js';
import { registerTickets } from './tickets.js';
import { registerPush } from './push.js';
import { registerTags } from './tags.js';
import type { AppConfig } from './config.js';
import { startJobs } from './jobs/index.js';
import { reconcileTicket } from './ticket/sla.js';
import type { SlaTicketReconciler } from './jobs/sla-consistency.js';
import { registerAuthGuard } from './kernel/index.js';
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
  const app = Fastify({ logger: config.logger ?? false });
  app.addHook('onClose', async () => jobs.close());
  registerAuthGuard(app, (token) => authenticate(config.pool, token));
  await app.register(rateLimit, { max: config.rateLimitMax ?? 1000, timeWindow: '1 minute' });
  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  for (const mod of modules) mod.register(app, config);
  registerSettings(app, config);
  registerTickets(app, config);
  registerReports(app, config);
  registerPush(app, config);
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
    app.log.error(error);
    reply.code(500).send(apiError('internal', 'Internal error'));
  });
  return app;
}
