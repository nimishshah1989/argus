import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import {
  apiError,
  isListName,
  listUpsertSchema,
  machineCriticalitySchema,
  settingsPutSchema,
  severityMatrixSchema,
  slaPoliciesUpdateSchema,
  translationSchema,
} from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { computeSeverity } from '@uptimo/domain';
import { loadSeverityMatrix } from './ticket/severity.js';
import { reconcileSlaPolicies } from './ticket/sla.js';
import { lockRefCounter } from './ticket-sql.js';
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
  // M2-2.1: validate the severity matrix shape before persisting it.
  if (key === 'severity_matrix') {
    const matrix = severityMatrixSchema.safeParse(parsed.data.value);
    if (!matrix.success) {
      reply.code(422).send(apiError('validation', 'Invalid severity matrix', 'value'));
      return;
    }
  }
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

function unchangedPolicies(
  before: Record<string, unknown>[],
  policies: Array<{
    severity: string;
    ackMinutes: number;
    restoreMinutes: number;
    businessHoursOnly: boolean;
  }>,
): boolean {
  return (
    before.length === 4 &&
    before.every((row, index) => {
      const policy = policies[index];
      return (
        policy &&
        row.severity === policy.severity &&
        row.ack_minutes === policy.ackMinutes &&
        row.restore_minutes === policy.restoreMinutes &&
        row.business_hours_only === policy.businessHoursOnly
      );
    })
  );
}

async function upsertSlaPolicies(
  client: Pick<PoolClient, 'query'>,
  input: {
    tenantId: string;
    loginId: string;
    before: Record<string, unknown>[];
    policies: Array<{
      severity: string;
      ackMinutes: number;
      restoreMinutes: number;
      businessHoursOnly: boolean;
    }>;
  },
): Promise<void> {
  const { tenantId, loginId, before, policies } = input;
  for (const policy of policies) {
    await client.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, business_hours_only)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, severity) DO UPDATE SET
         ack_minutes = EXCLUDED.ack_minutes,
         restore_minutes = EXCLUDED.restore_minutes,
         business_hours_only = EXCLUDED.business_hours_only,
         updated_at = now()`,
      [
        tenantId,
        policy.severity,
        policy.ackMinutes,
        policy.restoreMinutes,
        policy.businessHoursOnly,
      ],
    );
  }
  await client.query(
    'INSERT INTO audit_log (tenant_id, login_id, action, entity, before, after) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      tenantId,
      loginId,
      'sla_policy.update',
      'sla_policy',
      JSON.stringify(before),
      JSON.stringify(policies),
    ],
  );
}

async function putSlaPolicies(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  boss?: PgBoss,
) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const parsed = slaPoliciesUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Expected all four valid SLA policies'));
    return;
  }
  const policies = parsed.data.policies;
  await withTenant(pool, ctx.tenantId, async (client) => {
    await lockRefCounter(client, ctx.tenantId, 'BD');
    if (policies.some((policy) => policy.businessHoursOnly)) {
      const shifts = await client.query('SELECT 1 FROM shift LIMIT 1');
      if (shifts.rowCount === 0) {
        reply
          .code(422)
          .send(apiError('validation', 'Business hours require shift windows', 'policies'));
        return;
      }
    }
    const before = await client.query(
      'SELECT severity, ack_minutes, restore_minutes, business_hours_only FROM sla_policy ORDER BY severity',
    );
    const unchanged = unchangedPolicies(before.rows, policies);
    if (unchanged) {
      reply.send({ ok: true });
      return;
    }
    await upsertSlaPolicies(client, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      before: before.rows,
      policies,
    });
    await reconcileSlaPolicies(client, ctx.tenantId, boss);
  });
  if (!reply.sent) reply.send({ ok: true });
}

async function putMachineCriticality(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  boss?: PgBoss,
) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canWrite(ctx.role)) return forbidden(reply);
  const { id } = request.params as { id: string };
  const parsed = machineCriticalitySchema.safeParse(request.body);
  if (!parsed.success) {
    reply
      .code(422)
      .send(apiError('validation', 'Criticality must be A, B, C or null', 'criticality'));
    return;
  }
  const { criticality } = parsed.data;
  const updated = await withTenant(pool, ctx.tenantId, async (client) => {
    await lockRefCounter(client, ctx.tenantId, 'BD');
    const machine = await client.query(
      'UPDATE machine SET criticality = $2, updated_at = now() WHERE id = $1 RETURNING id',
      [id, criticality],
    );
    if (machine.rowCount === 0) return machine;
    // Severity follows current criticality; report-time snapshots stay unchanged.
    const matrix = await loadSeverityMatrix(client, ctx.tenantId);
    const tickets = await client.query(
      'SELECT id, kind, urgent FROM ticket WHERE tenant_id = $1 AND machine_id = $2 ORDER BY id FOR UPDATE',
      [ctx.tenantId, id],
    );
    if (tickets.rows.length > 0) {
      const severities = tickets.rows.map((ticket) =>
        computeSeverity(matrix, criticality, ticket.kind, ticket.urgent === true),
      );
      await client.query(
        `UPDATE ticket AS t SET severity = v.severity
         FROM UNNEST($1::uuid[], $2::text[]) AS v(id, severity)
         WHERE t.id = v.id AND t.tenant_id = $3`,
        [tickets.rows.map((ticket) => ticket.id), severities, ctx.tenantId],
      );
    }
    await reconcileSlaPolicies(client, ctx.tenantId, boss);
    return machine;
  });
  if (updated.rowCount === 0) {
    reply.code(404).send(apiError('not_found', 'Unknown machine', 'id'));
    return;
  }
  reply.send({ ok: true });
}

export function registerSettings(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.get('/api/v1/config', (request, reply) => handleConfig(pool, request, reply));
  app.get('/api/v1/settings', (request, reply) => listSettings(pool, request, reply));
  app.put('/api/v1/settings/sla-policies', (request, reply) =>
    putSlaPolicies(pool, request, reply, config.jobBoss),
  );
  app.put('/api/v1/settings/:key', (request, reply) => putSetting(pool, request, reply));
  app.put('/api/v1/machines/:id/criticality', (request, reply) =>
    putMachineCriticality(pool, request, reply, config.jobBoss),
  );
  app.get('/api/v1/lists/:list', (request, reply) => listItems(pool, request, reply));
  app.put('/api/v1/lists/:list/:code', (request, reply) => upsertListItem(pool, request, reply));
  app.delete('/api/v1/lists/:list/:id', (request, reply) => deleteListItem(pool, request, reply));
  app.get('/api/v1/translations/missing', (request, reply) =>
    missingTranslations(pool, request, reply),
  );
  app.put('/api/v1/translations/:id', (request, reply) => putTranslation(pool, request, reply));
}
