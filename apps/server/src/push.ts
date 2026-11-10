import webpush from 'web-push';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from './auth.js';
import type { AppConfig } from './config.js';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
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

interface SubscriptionRow {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function personExists(
  client: PoolClient,
  tenantId: string,
  personId: string,
): Promise<boolean> {
  const row = (
    await client.query('SELECT 1 FROM person WHERE tenant_id = $1 AND id = $2 AND active', [
      tenantId,
      personId,
    ])
  ).rows[0];
  return Boolean(row);
}

function rowsToSubs(rows: unknown[]): SubscriptionRow[] {
  return rows.map((row) => ({
    endpoint: (row as { endpoint: string }).endpoint,
    keys: (row as { keys: { p256dh: string; auth: string } }).keys,
  }));
}

async function callerSubscriptions(
  client: PoolClient,
  tenantId: string,
  loginId: string,
): Promise<SubscriptionRow[]> {
  const rows = (
    await client.query(
      'SELECT endpoint, keys FROM push_subscription WHERE tenant_id = $1 AND login_id = $2',
      [tenantId, loginId],
    )
  ).rows;
  return rowsToSubs(rows);
}

async function deliver(subs: SubscriptionRow[], payload: unknown): Promise<void> {
  await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub, JSON.stringify(payload))),
  );
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
  await withTenant(pool, auth.tenantId, async (client) => {
    if (!(await personExists(client, auth.tenantId, actingPersonId))) {
      return { missingPerson: true as const };
    }
    await client.query(
      `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, endpoint) DO UPDATE SET
         login_id = EXCLUDED.login_id, acting_person_id = EXCLUDED.acting_person_id,
         keys = EXCLUDED.keys, role = EXCLUDED.role, updated_at = now()`,
      [
        auth.tenantId,
        auth.loginId,
        actingPersonId,
        subscription.endpoint,
        JSON.stringify(subscription.keys),
        auth.role,
      ],
    );
    return { missingPerson: false as const };
  }).then((result) => {
    if (result.missingPerson) {
      reply.code(404).send(apiError('not_found', 'Unknown person', 'actingPersonId'));
    } else {
      reply.send({ ok: true });
    }
  });
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
    client.query('DELETE FROM push_subscription WHERE tenant_id = $1 AND endpoint = $2', [
      auth.tenantId,
      parsed.data.endpoint,
    ]),
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
    callerSubscriptions(client, auth.tenantId, auth.loginId),
  );
  await deliver(subs, { title: 'UPTIMO', body: 'Push works' });
  reply.send({ sent: subs.length });
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

/** Sends a push to every subscription bound to a person; used by M2 escalation, not wired yet. */
export async function sendPush(pool: Pool, personId: string, payload: unknown): Promise<void> {
  const vapid = vapidConfig();
  if (!vapid.configured) return;
  configureWebPush(vapid);
  const rows = (
    await pool.query('SELECT endpoint, keys FROM push_subscription WHERE acting_person_id = $1', [
      personId,
    ])
  ).rows;
  await deliver(rowsToSubs(rows), payload);
}
