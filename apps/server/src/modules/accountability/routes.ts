import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import {
  apiError,
  machineCriticalitySchema,
  rosterCopySchema,
  slaPoliciesUpdateSchema,
} from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { lockRefCounter, refreshMachineSeverity } from '../tickets/index.js';
import { reconcileSlaPolicies } from './sla.js';
import { currentPolicies, upsertPolicy, type PolicyInput } from './repo/policies.js';
import { requireAuth } from '../identity/index.js';
import type { AppConfig } from '../../kernel/index.js';
import { audit } from '../ops/index.js';
import { canSettingsLists, canSettingsSla } from '@uptimo/domain';
import {
  actorOf,
  forbidden,
  hasShifts,
  plantToday,
  registerResource,
  setMachineCriticality,
} from '../plant/index.js';
import { ROSTER_KEEP_DAYS, shiftDay } from './ladder.js';
import { copyRoster } from './repo/ladder.js';
import { LADDER_RESOURCES } from './settings-resources.js';

/** A copied roster repeats the source day for a week (the design's "Copy to the next 7 days"). */
const ROSTER_COPY_DAYS = 7;

function unchangedPolicies(before: Record<string, unknown>[], policies: PolicyInput[]): boolean {
  return (
    before.length === 4 &&
    before.every((row, index) => {
      const policy = policies[index];
      return (
        policy &&
        row.severity === policy.severity &&
        row.ack_minutes === policy.ackMinutes &&
        row.restore_minutes === policy.restoreMinutes &&
        (policy.pauseMaxMinutes === undefined ||
          row.pause_max_minutes === policy.pauseMaxMinutes) &&
        (policy.handbackMinutes === undefined || row.handback_minutes === policy.handbackMinutes) &&
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
    supportGrantId?: string | null;
    before: Record<string, unknown>[];
    policies: PolicyInput[];
  },
): Promise<void> {
  const { tenantId, loginId, supportGrantId, before, policies } = input;
  for (const policy of policies) await upsertPolicy(client, tenantId, policy);
  await audit.record(client, {
    tenantId,
    loginId,
    supportGrantId,
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
      supportGrantId: ctx.supportGrantId,
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

/** A pasted-together date is the field's one answer; the roster's own floor is the route's second refusal. */
const BAD_DATE = 'Use a date like 2026-11-14';
const TOO_OLD = 'Roster lines older than a year are not kept';

async function postRosterCopy(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  if (!canSettingsSla(actorOf(ctx))) return forbidden(reply);
  const parsed = rosterCopySchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(422).send(apiError('validation', BAD_DATE, 'date'));
    return;
  }
  const { date } = parsed.data;
  const outcome = await withTenant(pool, ctx.tenantId, async (client) => {
    const today = await plantToday(client, ctx.tenantId);
    if (date < shiftDay(today, -ROSTER_KEEP_DAYS)) return null;
    const counts = await copyRoster(client, ctx.tenantId, { date, days: ROSTER_COPY_DAYS });
    await audit.record(client, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      supportGrantId: ctx.supportGrantId,
      action: 'roster.copy',
      entity: 'roster_entry',
      before: null,
      after: { date, days: ROSTER_COPY_DAYS, created: counts.created, skipped: counts.skipped },
    });
    return counts;
  });
  if (!outcome) {
    reply.code(422).send(apiError('validation', TOO_OLD, 'date'));
    return;
  }
  reply.send(outcome);
}

export function registerSettings(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.put('/api/v1/settings/sla-policies', (request, reply) =>
    putSlaPolicies(pool, request, reply, config.jobBoss),
  );
  app.post('/api/v1/roster/copy', (request, reply) => postRosterCopy(pool, request, reply));
  for (const resource of LADDER_RESOURCES) {
    // A saved rule re-arms what it governs (the tickets already down), as saving the clocks' targets does.
    const afterSave = (tx: PoolClient, tenantId: string) =>
      reconcileSlaPolicies(tx, tenantId, config.jobBoss);
    registerResource(
      app,
      pool,
      resource.table === 'escalation_rule' ? { ...resource, afterSave } : resource,
    );
  }
  app.put('/api/v1/machines/:id/criticality', (request, reply) =>
    putMachineCriticality(pool, request, reply, config.jobBoss),
  );
}
