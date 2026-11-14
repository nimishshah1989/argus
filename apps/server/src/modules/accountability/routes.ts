import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { apiError, machineCriticalitySchema, slaPoliciesUpdateSchema } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { lockRefCounter, refreshMachineSeverity } from '../tickets/index.js';
import { reconcileSlaPolicies } from './sla.js';
import { currentPolicies, upsertPolicy } from './repo/policies.js';
import { requireAuth } from '../identity/index.js';
import type { AppConfig } from '../../kernel/index.js';
import { audit } from '../ops/index.js';
import { canSettingsLists, canSettingsSla } from '@uptimo/domain';
import { actorOf, forbidden, hasShifts, setMachineCriticality } from '../plant/index.js';

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
  for (const policy of policies) await upsertPolicy(client, tenantId, policy);
  await audit.record(client, {
    tenantId,
    loginId,
    action: 'sla_policy.update',
    entity: 'sla_policy',
    before,
    after: policies,
  });
}

async function putSlaPolicies(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  boss?: PgBoss,
) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canSettingsSla(actorOf(ctx))) return forbidden(reply);
  const parsed = slaPoliciesUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', 'Expected all four valid SLA policies'));
    return;
  }
  const policies = parsed.data.policies;
  await withTenant(pool, ctx.tenantId, async (client) => {
    await lockRefCounter(client, ctx.tenantId, 'BD');
    if (policies.some((policy) => policy.businessHoursOnly)) {
      if (!(await hasShifts(client))) {
        reply
          .code(422)
          .send(apiError('validation', 'Business hours require shift windows', 'policies'));
        return;
      }
    }
    const before = await currentPolicies(client);
    const unchanged = unchangedPolicies(before, policies);
    if (unchanged) {
      reply.send({ ok: true });
      return;
    }
    await upsertSlaPolicies(client, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      before,
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
  if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
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
    const set = await setMachineCriticality(client, id, criticality);
    if (!set) return false;
    await refreshMachineSeverity(client, { tenantId: ctx.tenantId, machineId: id, criticality });
    await reconcileSlaPolicies(client, ctx.tenantId, boss);
    if (set.before !== criticality) {
      await audit.record(client, {
        tenantId: ctx.tenantId,
        loginId: ctx.loginId,
        action: 'machine.criticality',
        entity: 'machine',
        entityId: id,
        before: { criticality: set.before },
        after: { criticality },
      });
    }
    return true;
  });
  if (!updated) {
    reply.code(404).send(apiError('not_found', 'Unknown machine', 'id'));
    return;
  }
  reply.send({ ok: true });
}

export function registerSettings(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.put('/api/v1/settings/sla-policies', (request, reply) =>
    putSlaPolicies(pool, request, reply, config.jobBoss),
  );
  app.put('/api/v1/machines/:id/criticality', (request, reply) =>
    putMachineCriticality(pool, request, reply, config.jobBoss),
  );
}
