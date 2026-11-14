import webpush from 'web-push';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { lockLiveActing, requireAuth } from '../identity/index.js';
import { AUTH_MESSAGES, type AppConfig } from '../../kernel/index.js';
import { isPushEndpoint, normalisedEndpoint } from './endpoint.js';
import {
  deleteSubscription,
  subscriptionsOfLogin,
  upsertSubscription,
  type SubscriptionRow,
} from './repo.js';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().max(2048).refine(isPushEndpoint),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  actingPersonId: z.string().uuid(),
});
const unsubscribeSchema = z.object({ endpoint: z.string().min(1) });

interface Vapid {
  configured: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
}

function vapidConfig(): Vapid {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  return {
    configured: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT ?? 'mailto:ops@example.com',
  };
}

function configureWebPush(vapid: Vapid): void {
  if (vapid.configured) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  }
}

/** Sends to the subscriptions that name a real push service; returns how many that was. */
async function deliver(subs: SubscriptionRow[], payload: unknown): Promise<number> {
  // Rows saved before the address rule may still hold an internal address: never send to those.
  const safe = subs.filter((sub) => isPushEndpoint(sub.endpoint));
  await Promise.allSettled(
    safe.map((sub) => webpush.sendNotification(sub, JSON.stringify(payload))),
  );
  return safe.length;
}

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
  const { subscription, actingPersonId } = parsed.data;
  const check = await withTenant(pool, auth.tenantId, async (client) => {
    const live = await lockLiveActing(client, {
      tenantId: auth.tenantId,
      loginId: auth.loginId,
      personId: actingPersonId,
    });
    if (live === 'ok')
      await upsertSubscription(client, {
        tenantId: auth.tenantId,
        loginId: auth.loginId,
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

async function testHandler(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = await requireAuth(pool, request, reply);
  if (!auth) return;
  const vapid = vapidConfig();
  if (!vapid.configured) {
    reply.code(503).send(apiError('not_configured', 'Push is not configured'));
    return;
  }
  configureWebPush(vapid);
  const subs = await withTenant(pool, auth.tenantId, (client) =>
    subscriptionsOfLogin(client, auth.tenantId, auth.loginId),
  );
  const sent = await deliver(subs, { title: 'UPTIMO', body: 'Push works' });
  reply.send({ sent });
}

export function registerPush(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/push/key', (request, reply) => keyHandler(pool, request, reply));
  app.post('/api/v1/push/subscribe', (request, reply) => subscribeHandler(pool, request, reply));
  app.post('/api/v1/push/unsubscribe', (request, reply) =>
    unsubscribeHandler(pool, request, reply),
  );
  app.post('/api/v1/push/test', (request, reply) => testHandler(pool, request, reply));
}
