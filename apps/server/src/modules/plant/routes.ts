import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import {
  apiError,
  isListName,
  listUpsertSchema,
  settingsPutSchema,
  translationSchema,
} from '@uptimo/shared';
import { canSettingsLists, canSettingsPeople } from '@uptimo/domain';
import { withTenant, type AppConfig } from '../../kernel/index.js';
import { requireAuth, tenantInfo, updateTenantProfile } from '../identity/index.js';
import { audit } from '../ops/index.js';
import {
  deactivateListItem,
  saveListItem,
  selectListItems,
  selectMissingTranslations,
  selectSetting,
  selectSettings,
  updateTranslation,
  upsertSetting,
} from './repo/config.js';
import { writableSetting } from './settings.js';
import { fingerprint, loadConfig } from './service.js';
import { actorOf, forbidden } from './actor.js';
import { registerCompanyRoutes } from './company-routes.js';
import { registerPlantSettingsRoutes } from './settings-routes.js';

function withoutPhone(p: unknown): Record<string, unknown> {
  const copy = { ...(p as Record<string, unknown>) };
  delete copy.phone;
  return copy;
}

async function handleConfig(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const full = await loadConfig(pool, ctx.tenantId);
  const actor = actorOf(ctx);
  const payload = canSettingsPeople(actor)
    ? full
    : { ...full, people: full.people.map(withoutPhone) };
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
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
  const rows = await withTenant(pool, ctx.tenantId, async (client) => {
    const tenant = await tenantInfo(client, ctx.tenantId);
    return [
      ...(await selectSettings(client)),
      { key: 'company.name', value: tenant.name },
      { key: 'company.language', value: tenant.language },
      { key: 'company.timeZone', value: tenant.time_zone },
    ];
  });
  reply.send(rows);
}

const TENANT_FIELD = { name: 'name', language: 'language', timeZone: 'time_zone' } as const;

/** Writes one setting and audits the change (not an unchanged value): to `setting`, or to the plant's own record. */
async function writeSetting(
  client: PoolClient,
  ctx: { tenantId: string; loginId: string },
  change: { key: string; setting: NonNullable<ReturnType<typeof writableSetting>>; value: unknown },
): Promise<void> {
  const { key, setting, value } = change;
  const { profile } = setting;
  const before = profile
    ? (await tenantInfo(client, ctx.tenantId))[TENANT_FIELD[profile]]
    : await selectSetting(client, key);
  if (profile) await updateTenantProfile(client, { [profile]: value as string });
  else await upsertSetting(client, ctx.tenantId, key, value);
  // A time zone is stored as the database spells it (`asia/kolkata` is `Asia/Kolkata`): audit what was stored.
  const stored = profile ? (await tenantInfo(client, ctx.tenantId))[TENANT_FIELD[profile]] : value;
  if (isDeepStrictEqual(before, stored)) return;
  await audit.record(client, {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    action: 'setting.update',
    entity: 'setting',
    before: { key, value: before ?? null },
    after: { key, value: stored },
  });
}

async function putSetting(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = (request.params as { key: string }).key;
  const setting = writableSetting(key);
  if (!setting) {
    reply.code(404).send(apiError('not_found', 'Unknown setting'));
    return;
  }
  const actor = actorOf(ctx);
  if (!setting.allow(actor)) return forbidden(reply);
  const body = settingsPutSchema.safeParse(request.body);
  const value = body.success ? setting.schema.safeParse(body.data.value) : null;
  if (!value?.success) {
    reply.code(422).send(apiError('validation', 'Invalid setting', 'value'));
    return;
  }
  try {
    await withTenant(pool, ctx.tenantId, (client) =>
      writeSetting(client, ctx, { key, setting, value: value.data }),
    );
  } catch (error) {
    // The database is the judge of a time zone or a name it refuses (its own `RAISE`): a bad value, not a fault.
    if ((error as { code?: string }).code !== 'P0001') throw error;
    reply.code(422).send(apiError('validation', 'The database refused this value', 'value'));
    return;
  }
  reply.send({ ok: true });
}

async function listItems(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
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
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
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
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
  const { id } = request.params as { id: string };
  await withTenant(pool, ctx.tenantId, (client) => deactivateListItem(client, id));
  reply.send({ ok: true });
}

async function missingTranslations(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
  const rows = await withTenant(pool, ctx.tenantId, (client) => selectMissingTranslations(client));
  reply.send(rows);
}

async function putTranslation(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
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
  registerPlantSettingsRoutes(app, pool);
  registerCompanyRoutes(app, config);
}
