import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { hashToken, lockLiveActing, lockLiveSession, requireAuth } from '../identity/index.js';
import { actingRefusal, AUTH_MESSAGES, type AppConfig } from '../../kernel/index.js';
import { isPushEndpoint, normalisedEndpoint } from './endpoint.js';
import { notify } from './notify.js';
import { vapidConfig } from './push.js';
import { deleteSubscription, upsertSubscription } from './repo.js';
import { processNotification } from './send.js';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().max(2048).refine(isPushEndpoint),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  actingPersonId: z.string().uuid().optional(),
});
const TEST_PUSHES_PER_MINUTE = 10;
const unsubscribeSchema = z.object({ endpoint: z.string().min(1) });

async function keyHandler(pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = await requireAuth(pool, request, reply);
  if (!auth) return;
  const vapid = vapidConfig();
  if (!vapid.configured) {
    reply.code(503).send(apiError('not_configured', 'Push is not configured'));
    return;
  }
  reply.send({ publicKey: vapid.publicKey });
}

async function subscribeHandler(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = await requireAuth(pool, request, reply);
  if (!auth) return;
  const parsed = subscribeSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Invalid subscription'));
    return;
  }
  const { subscription } = parsed.data;
  // A phone is registered for the person using it, never for someone whose notifications it would then receive.
  const refused = actingRefusal(auth, parsed.data.actingPersonId, 'actingPersonId');
  if (refused) {
    reply.code(refused.status).send(refused.body);
    return;
  }
  const actingPersonId = auth.personId as string;
  const check = await withTenant(pool, auth.tenantId, async (client) => {
    const live = await lockLiveActing(client, {
      tenantId: auth.tenantId,
      loginId: auth.loginId,
      personId: actingPersonId,
    });
    if (live !== 'ok') return live;
    const sessionId = await lockLiveSession(client, hashToken(auth.token));
    if (!sessionId) return 'login_off';
    await upsertSubscription(client, {
      tenantId: auth.tenantId,
      loginId: auth.loginId,
      sessionId,
      actingPersonId,
      endpoint: normalisedEndpoint(subscription.endpoint),
      keys: JSON.stringify(subscription.keys),
      role: auth.role,
    });
    return live;
  });
  if (check === 'ok') reply.send({ ok: true });
  else if (check === 'unknown_person')
    reply.code(404).send(apiError('not_found', 'Unknown person', 'actingPersonId'));
  else reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.ended));
}

async function unsubscribeHandler(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = await requireAuth(pool, request, reply);
  if (!auth) return;
  const parsed = unsubscribeSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Invalid endpoint'));
    return;
  }
  await withTenant(pool, auth.tenantId, (client) =>
    deleteSubscription(
      client,
      auth.tenantId,
      isPushEndpoint(parsed.data.endpoint)
        ? normalisedEndpoint(parsed.data.endpoint)
        : parsed.data.endpoint,
    ),
  );
  reply.send({ ok: true });
}

/** Sends a test push to the acting person's own phones, through the same path every notification takes. */
async function testHandler(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = await requireAuth(pool, request, reply);
  if (!auth) return;
  if (!vapidConfig().configured) {
    reply.code(503).send(apiError('not_configured', 'Push is not configured'));
    return;
  }
  if (!auth.personId) {
    reply
      .code(403)
      .send(apiError('choose_acting_person', 'Choose who is using this phone to continue'));
    return;
  }
  const now = new Date();
  const [made] = await withTenant(pool, auth.tenantId, (client) =>
    notify(client, null, {
      tenantId: auth.tenantId,
      to: [auth.personId!],
      kind: 'push.test',
      dedupeKey: `push-test:${randomUUID()}`,
      now,
    }),
  );
  const { delivered } = await processNotification(
    { pool, boss: null, now },
    { tenantId: auth.tenantId, notificationId: made!.notificationId },
  );
  reply.send({ sent: delivered });
}

export function registerPush(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/push/key', (request, reply) => keyHandler(pool, request, reply));
  app.post('/api/v1/push/subscribe', (request, reply) => subscribeHandler(pool, request, reply));
  app.post('/api/v1/push/unsubscribe', (request, reply) =>
    unsubscribeHandler(pool, request, reply),
  );
  // The test button sends in this request and holds a database connection while it waits for the push service.
  app.post(
    '/api/v1/push/test',
    { config: { rateLimit: { max: TEST_PUSHES_PER_MINUTE, timeWindow: '1 minute' } } },
    (request, reply) => testHandler(pool, request, reply),
  );
}
