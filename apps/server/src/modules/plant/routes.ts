import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import {
  apiError,
  isListName,
  listUpsertSchema,
  settingsPutSchema,
  severityMatrixSchema,
  translationSchema,
} from '@uptimo/shared';
import { withTenant, type AppConfig } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import {
  deactivateListItem,
  saveListItem,
  selectListItems,
  selectMissingTranslations,
  selectSettings,
  updateTranslation,
  upsertSetting,
} from './repo/config.js';
import { fingerprint, loadConfig } from './service.js';

export function canWrite(role: string): boolean {
  return role === 'admin' || role === 'head';
}

export function forbidden(reply: FastifyReply): void {
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
  const rows = await withTenant(pool, ctx.tenantId, (client) => selectSettings(client));
  reply.send(rows);
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
  // M2-2.1: validate the severity matrix shape before persisting it.
  if (key === 'severity_matrix') {
    const matrix = severityMatrixSchema.safeParse(parsed.data.value);
    if (!matrix.success) {
      reply.code(422).send(apiError('validation', 'Invalid severity matrix', 'value'));
      return;
    }
  }
  await withTenant(pool, ctx.tenantId, (client) =>
    upsertSetting(client, ctx.tenantId, key, parsed.data.value),
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
  const rows = await withTenant(pool, ctx.tenantId, (client) => selectListItems(client, list));
  reply.send(rows);
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
  await withTenant(pool, ctx.tenantId, (client) =>
    saveListItem(client, { tenantId: ctx.tenantId, list, code, body: parsed.data }),
  );
  reply.send({ ok: true });
}

async function deleteListItem(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const { id } = request.params as { id: string };
  await withTenant(pool, ctx.tenantId, (client) => deactivateListItem(client, id));
  reply.send({ ok: true });
}

async function missingTranslations(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const rows = await withTenant(pool, ctx.tenantId, (client) => selectMissingTranslations(client));
  reply.send(rows);
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
    updateTranslation(client, id, parsed.data.labelGu ?? null, parsed.data.labelHi ?? null),
  );
  reply.send({ ok: true });
}

export function registerPlantRoutes(app: FastifyInstance, config: AppConfig): void {
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
