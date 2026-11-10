import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import {
  apiError,
  isListName,
  listUpsertSchema,
  settingsPutSchema,
  translationSchema,
} from '@argus/shared';
import { withTenant } from '@argus/db';
import { requireAuth } from './auth.js';
import { fingerprint, loadConfig } from './config.js';
import type { AppConfig } from './config.js';

function canWrite(role: string): boolean {
  return role === 'admin' || role === 'head';
}

function forbidden(reply: FastifyReply): void {
  reply.code(403).send(apiError('forbidden', 'You do not have permission for this action'));
}

async function handleConfig(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const payload = await loadConfig(pool, ctx.tenantId);
  const fp = fingerprint(payload);
  const requested = (request.query as { fp?: string }).fp;
  if (requested === fp) {
    reply.send({ same: true, fp });
    return;
  }
  reply.send({ ...payload, fp });
}

async function listSettings(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const rows = await withTenant(pool, ctx.tenantId, (client) =>
    client.query('SELECT key, value FROM setting ORDER BY key'),
  );
  reply.send(rows.rows);
}

async function putSetting(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const parsed = settingsPutSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Invalid setting'));
    return;
  }
  const key = (request.params as { key: string }).key;
  await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      'INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [ctx.tenantId, key, JSON.stringify(parsed.data.value)],
    ),
  );
  reply.send({ ok: true });
}

async function listItems(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const list = (request.params as { list: string }).list;
  if (!isListName(list)) {
    reply.code(404).send(apiError('not_found', 'Unknown list'));
    return;
  }
  const rows = await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      'SELECT id, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag FROM list_item WHERE list = $1 ORDER BY sort, code',
      [list],
    ),
  );
  reply.send(rows.rows);
}

async function upsertListItem(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const { list, code } = request.params as { list: string; code: string };
  if (!isListName(list)) {
    reply.code(404).send(apiError('not_found', 'Unknown list'));
    return;
  }
  const parsed = listUpsertSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(apiError('validation', 'Invalid list item', field));
    return;
  }
  const body = parsed.data;
  await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      `INSERT INTO list_item (tenant_id, list, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, list, code) DO UPDATE SET
         label = EXCLUDED.label, label_gu = EXCLUDED.label_gu, label_hi = EXCLUDED.label_hi,
         sort = EXCLUDED.sort, active = EXCLUDED.active, is_vendor = EXCLUDED.is_vendor,
         pauses_sla = EXCLUDED.pauses_sla, tag = EXCLUDED.tag, updated_at = now()`,
      [
        ctx.tenantId,
        list,
        code,
        body.label,
        body.labelGu ?? null,
        body.labelHi ?? null,
        body.sort ?? 0,
        body.active ?? true,
        body.isVendor ?? false,
        body.pausesSla ?? false,
        body.tag ?? null,
      ],
    ),
  );
  reply.send({ ok: true });
}

async function deleteListItem(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const { id } = request.params as { id: string };
  await withTenant(pool, ctx.tenantId, (client) =>
    client.query('DELETE FROM list_item WHERE id = $1', [id]),
  );
  reply.send({ ok: true });
}

async function missingTranslations(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const rows = await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      "SELECT id, list, code, label, label_gu, label_hi FROM list_item WHERE label_gu IS NULL OR label_gu = '' ORDER BY list, code",
    ),
  );
  reply.send(rows.rows);
}

async function putTranslation(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const parsed = translationSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Invalid translation'));
    return;
  }
  const { id } = request.params as { id: string };
  await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      'UPDATE list_item SET label_gu = COALESCE($2, label_gu), label_hi = COALESCE($3, label_hi), updated_at = now() WHERE id = $1',
      [id, parsed.data.labelGu ?? null, parsed.data.labelHi ?? null],
    ),
  );
  reply.send({ ok: true });
}

export function registerSettings(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/config', (request, reply) => handleConfig(pool, request, reply));
  app.get('/api/v1/settings', (request, reply) => listSettings(pool, request, reply));
  app.put('/api/v1/settings/:key', (request, reply) => putSetting(pool, request, reply));
  app.get('/api/v1/lists/:list', (request, reply) => listItems(pool, request, reply));
  app.put('/api/v1/lists/:list/:code', (request, reply) => upsertListItem(pool, request, reply));
  app.delete('/api/v1/lists/:list/:id', (request, reply) => deleteListItem(pool, request, reply));
  app.get('/api/v1/translations/missing', (request, reply) =>
    missingTranslations(pool, request, reply),
  );
  app.put('/api/v1/translations/:id', (request, reply) => putTranslation(pool, request, reply));
}
