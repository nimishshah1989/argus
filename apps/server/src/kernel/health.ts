import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './module.js';

/** True when the check resolves to something in time; a rejection or a slow answer counts as down. */
async function within(check: () => Promise<unknown>, ms = 2000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
    timer.unref();
  });
  try {
    return await Promise.race([Promise.resolve().then(check).then(Boolean), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function registerHealth(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/v1/health', { config: { rateLimit: false } }, async (request, reply) => {
    const [db, queue] = await Promise.all([
      within(() => config.pool.query('SELECT 1')),
      within(async () => config.jobBoss?.getQueue('sla.timer')),
    ]);
    if (db && queue) return { status: 'ok' };
    request.log.warn({ db, queue }, 'health check failed');
    return reply.code(503).send({ status: 'down', db, queue });
  });
}
