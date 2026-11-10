import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { apiError } from '@argus/shared';
import { registerAuth } from './auth.js';
import type { AppConfig } from './config.js';

export async function buildApp(config: AppConfig) {
  const app = Fastify({ logger: config.logger ?? false });
  await app.register(rateLimit, { max: config.rateLimitMax ?? 1000, timeWindow: '1 minute' });
  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuth(app, config);
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      reply.code(429).send(apiError('rate_limited', 'Too many requests'));
      return;
    }
    app.log.error(error);
    reply.code(500).send(apiError('internal', 'Internal error'));
  });
  return app;
}
