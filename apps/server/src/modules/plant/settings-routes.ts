import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { apiError, type ErrorCode } from '@uptimo/shared';
import { canSettingsLists } from '@uptimo/domain';
import { withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { actorOf, forbidden } from './actor.js';
import {
  exists,
  insertRow,
  selectAll,
  selectMoves,
  selectOne,
  updateRow,
  type Row,
} from './repo/plant-settings.js';
import { RESOURCES, type Problem, type Resource } from './settings-resources.js';

type Ctx = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
type Reply = Record<string, unknown>;
interface Outcome {
  status: number;
  body: unknown;
}

const refuse = (status: number, code: ErrorCode, message: string, field?: string): Outcome => ({
  status,
  body: apiError(code, message, field),
});
const invalid = ({ field, message }: Problem) => refuse(422, 'validation', message, field);
const notFound = (what: string) => refuse(404, 'not_found', `Unknown ${what}`, 'id');

function pick(reply: Reply, keys: string[]): Reply {
  return Object.fromEntries(keys.map((key) => [key, reply[key]]));
}

/** The reply keys whose value differs, so an audit line shows only what the edit touched. */
function changedKeys(before: Reply, after: Reply): string[] {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}

function columnsOf(resource: Resource, values: Reply): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(resource.columns)) {
    if (key in values) out[column] = values[key];
  }
  return out;
}

function auditEntry(ctx: Ctx, resource: Resource, action: string, entityId: string) {
  return {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    action,
    entity: resource.table,
    entityId,
  } as const;
}

async function create(tx: PoolClient, ctx: Ctx, resource: Resource, body: Reply): Promise<Outcome> {
  const problem = await resource.check?.(tx, body);
  if (problem) return invalid(problem);
  const values = { ...columnsOf(resource, body), ...resource.derive?.(body) };
  const row = await insertRow(tx, resource.table, ctx.tenantId, values);
  const reply = resource.reply(row);
  await audit.record(tx, {
    ...auditEntry(ctx, resource, `${resource.kind}.create`, reply.id as string),
    before: null,
    after: reply,
  });
  return { status: 201, body: reply };
}

async function edit(
  tx: PoolClient,
  ctx: Ctx,
  resource: Resource,
  target: { id: string; patch: Reply },
): Promise<Outcome> {
  const current = await selectOne(tx, resource.table, target.id);
  if (!current) return notFound(resource.kind);
  const before = resource.reply(current);
  const merged = { ...before, ...target.patch };
  const touched = Object.keys(resource.columns).filter(
    (key) => key in target.patch && target.patch[key] !== before[key],
  );
  if (touched.length === 0) return { status: 200, body: before };
  const problem = await resource.check?.(tx, merged, target.patch);
  if (problem) return invalid(problem);
  const values = { ...columnsOf(resource, target.patch), ...resource.derive?.(merged) };
  const after = resource.reply(await updateRow(tx, resource.table, target.id, values));
  const changed = changedKeys(before, after);
  await resource.afterEdit?.(tx, { tenantId: ctx.tenantId, before, after, patch: target.patch });
  await audit.record(tx, {
    ...auditEntry(
      ctx,
      resource,
      resource.actionFor?.(before, after) ?? `${resource.kind}.update`,
      target.id,
    ),
    before: pick(before, changed),
    after: pick(after, changed),
  });
  return { status: 200, body: after };
}

/** Auth, then the permission cell (DOMAIN §3), then the body. Null when the reply is already sent. */
async function gate(pool: Pool, request: FastifyRequest, reply: FastifyReply, write: boolean) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return null;
  if (write && !canSettingsLists(actorOf(ctx))) {
    forbidden(reply);
    return null;
  }
  return ctx;
}

async function run(
  pool: Pool,
  ctx: Ctx,
  reply: FastifyReply,
  work: (tx: PoolClient) => Promise<Outcome>,
): Promise<void> {
  try {
    const outcome = await withTenant(pool, ctx.tenantId, work);
    reply.code(outcome.status).send(outcome.body);
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    reply.code(409).send(apiError('conflict', 'That code is already used', 'code'));
  }
}

/** A zod failure as a 422 that names the field; a key the screen may not send names that key. */
function fieldProblem(error: {
  issues: { code: string; path: PropertyKey[]; message: string; keys?: string[] }[];
}): Outcome {
  const issue = error.issues[0]!;
  if (issue.code === 'unrecognized_keys' && issue.keys?.[0]) {
    return refuse(422, 'validation', `${issue.keys[0]} cannot be set here`, issue.keys[0]);
  }
  return refuse(422, 'validation', issue.message, issue.path.map(String).join('.') || undefined);
}

function registerResource(app: FastifyInstance, pool: Pool, resource: Resource): void {
  const base = `/api/v1/${resource.path}`;
  app.get(base, async (request, reply) => {
    const ctx = await gate(pool, request, reply, false);
    if (!ctx) return;
    const rows = await withTenant(pool, ctx.tenantId, (tx) =>
      selectAll(tx, resource.table, resource.order),
    );
    reply.send(rows.map(resource.reply));
  });
  app.post(base, async (request, reply) => {
    const ctx = await gate(pool, request, reply, true);
    if (!ctx) return;
    const parsed = resource.create.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    await run(pool, ctx, reply, (tx) => create(tx, ctx, resource, parsed.data));
  });
  app.patch(`${base}/:id`, async (request, reply) => {
    const ctx = await gate(pool, request, reply, true);
    if (!ctx) return;
    const parsed = resource.patch.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    const { id } = request.params as { id: string };
    await run(pool, ctx, reply, (tx) => edit(tx, ctx, resource, { id, patch: parsed.data }));
  });
}

export function registerPlantSettingsRoutes(app: FastifyInstance, pool: Pool): void {
  for (const resource of RESOURCES) registerResource(app, pool, resource);
  const machines = RESOURCES.find((r) => r.path === 'machines')!;
  // Never a hard delete: a machine with history keeps it. Switching off is `status: 'scrapped'`.
  app.delete('/api/v1/machines/:id', async (request, reply) => {
    const ctx = await gate(pool, request, reply, true);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    await run(pool, ctx, reply, (tx) =>
      edit(tx, ctx, machines, { id, patch: { status: 'scrapped' } }),
    );
  });
  app.get('/api/v1/machines/:id/moves', async (request, reply) => {
    const ctx = await gate(pool, request, reply, false);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    const moves: Row[] | null = await withTenant(pool, ctx.tenantId, async (tx) =>
      (await exists(tx, 'machine', id)) ? selectMoves(tx, id) : null,
    );
    if (!moves) return reply.code(404).send(notFound('machine').body);
    reply.send(
      moves.map((m) => ({
        id: m.id,
        machineId: m.machine_id,
        fromCell: m.from_cell,
        toCell: m.to_cell,
        effectiveFrom: m.effective_from,
      })),
    );
  });
}
