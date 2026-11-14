import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { apiError } from '@uptimo/shared';
import { canSettingsLists } from '@uptimo/domain';
import {
  fieldProblem,
  idOrNotFound,
  refuse,
  withTenant,
  type Refusal,
} from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { actorOf, forbidden } from './actor.js';
import {
  exists,
  selectMoves,
  tableStore,
  type SettingsTable,
  type Store,
  type Row,
} from './repo/plant-settings.js';
import { LIST_RESOURCES } from './settings-lists.js';
import { RESOURCES, type Problem, type Resource } from './settings-resources.js';

type Ctx = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;
type Reply = Record<string, unknown>;
type Outcome = Refusal;

/** The resource's own store, or the generic one over one of the plant's own tables. */
const storeOf = (resource: Resource): Store =>
  resource.store ?? tableStore(resource.table as SettingsTable, resource.order, resource.scope);

const invalid = ({ field, message, conflict }: Problem) =>
  conflict ? refuse(409, 'conflict', message, field) : refuse(422, 'validation', message, field);
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

/** A generated form sends an empty text for "none". */
function tidy(values: Reply): Reply {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v]));
}

function auditEntry(ctx: Ctx, resource: Resource, action: string, entityId: string) {
  return {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    supportGrantId: ctx.supportGrantId,
    action,
    entity: resource.table,
    entityId,
  } as const;
}

async function create(tx: PoolClient, ctx: Ctx, resource: Resource, body: Reply): Promise<Outcome> {
  const fields = tidy(body);
  await resource.prepare?.(tx, ctx);
  const problem = await resource.check?.(tx, fields, undefined, ctx.tenantId);
  if (problem) return invalid(problem);
  const { scope } = resource;
  const values = {
    ...columnsOf(resource, fields),
    ...(scope ? { [scope.column]: scope.value } : {}),
    ...resource.derive?.(fields),
  };
  const row = await storeOf(resource).insert(tx, ctx.tenantId, values);
  const reply = resource.reply(row);
  await resource.afterSave?.(tx, ctx.tenantId);
  await audit.record(tx, {
    ...auditEntry(ctx, resource, `${resource.kind}.create`, reply.id as string),
    before: null,
    after: reply,
  });
  return { status: 201, body: reply };
}

/**
 * The columns an edit may change: the form's fields, with `active` turned into the resource's own switch
 * (only when it differs from now, so a form that sends the old `active` back never undoes an edit), and
 * a fixed key accepted only when it is unchanged.
 */
function resolveFields(resource: Resource, before: Reply, patch: Reply): Reply | Problem {
  const { active, ...rest } = patch;
  const fields = tidy(rest);
  for (const key of resource.fixed ?? []) {
    if (!(key in fields)) continue;
    if (fields[key] !== before[key])
      return { field: key, message: `${key} cannot be changed here` };
    delete fields[key];
  }
  if (active === undefined || active === before.active) return fields;
  if (!resource.switchTo) return { field: 'active', message: 'This cannot be switched off yet' };
  return { ...fields, ...resource.switchTo(active as boolean, before) };
}

/** A store with `remove` takes `active: false` as "take it off": the row goes, the audit keeps what it held. */
async function remove(
  tx: PoolClient,
  ctx: Ctx,
  resource: Resource,
  before: Reply,
): Promise<Outcome> {
  const id = before.id as string;
  await storeOf(resource).remove?.(tx, id);
  await audit.record(tx, {
    ...auditEntry(ctx, resource, `${resource.kind}.remove`, id),
    before,
    after: null,
  });
  return { status: 200, body: { ...before, active: false } };
}

const isProblem = (value: Reply | Problem): value is Problem =>
  'message' in value && 'field' in value;

async function edit(
  tx: PoolClient,
  ctx: Ctx,
  resource: Resource,
  target: { id: string; patch: Reply },
): Promise<Outcome> {
  const current = await storeOf(resource).one(tx, target.id);
  if (!current) return notFound(resource.kind);
  const before = resource.reply(current);
  if (resource.store?.remove && target.patch.active === false)
    return remove(tx, ctx, resource, before);
  return update(tx, ctx, resource, { ...target, before });
}

async function update(
  tx: PoolClient,
  ctx: Ctx,
  resource: Resource,
  target: { id: string; patch: Reply; before: Reply },
): Promise<Outcome> {
  const { before } = target;
  const fields = resolveFields(resource, before, target.patch);
  if (isProblem(fields)) return invalid(fields);
  const touched = Object.keys(resource.columns).filter(
    (key) => key in fields && fields[key] !== before[key],
  );
  if (touched.length === 0) return { status: 200, body: before };
  const merged = { ...before, ...fields };
  const proposed = { tenantId: ctx.tenantId, before, patch: fields };
  const problem = await resource.check?.(tx, merged, proposed, ctx.tenantId);
  if (problem) return invalid(problem);
  const values = { ...columnsOf(resource, pick(fields, touched)), ...resource.derive?.(merged) };
  const after = resource.reply(await storeOf(resource).update(tx, target.id, values));
  const changed = changedKeys(before, after);
  if (changed.length === 0) return { status: 200, body: after };
  await resource.afterEdit?.(tx, { tenantId: ctx.tenantId, before, after, patch: fields });
  await resource.afterSave?.(tx, ctx.tenantId);
  const action = resource.actionFor?.(before, after) ?? `${resource.kind}.update`;
  await audit.record(tx, {
    ...auditEntry(ctx, resource, action, target.id),
    before: pick(before, changed),
    after: pick(after, changed),
  });
  return { status: 200, body: after };
}

/**
 * Auth, then the permission cell (DOMAIN §3: settings are head and admin, to read and to write; the floor and
 * the desk read `/config`), then the body. Null when the reply is already sent.
 */
async function gate(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  can: Resource['can'] = canSettingsLists,
) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return null;
  if (!can(actorOf(ctx))) {
    forbidden(reply);
    return null;
  }
  return ctx;
}

async function run(
  pool: Pool,
  target: { ctx: Ctx; reply: FastifyReply; uniqueField?: string; taken?: string },
  work: (tx: PoolClient) => Promise<Outcome>,
): Promise<void> {
  const { ctx, reply, uniqueField = 'code', taken } = target;
  try {
    const outcome = await withTenant(pool, ctx.tenantId, work);
    reply.code(outcome.status).send(outcome.body);
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    reply
      .code(409)
      .send(apiError('conflict', taken ?? `That ${uniqueField} is already used`, uniqueField));
  }
}

/** The generic list, create and edit routes for one resource (accountability registers its own through this). */
export function registerResource(app: FastifyInstance, pool: Pool, resource: Resource): void {
  const base = `/api/v1/${resource.path}`;
  app.get(base, async (request, reply) => {
    const ctx = await gate(pool, request, reply, resource.can);
    if (!ctx) return;
    const outcome = await withTenant(pool, ctx.tenantId, async (tx): Promise<Outcome> => {
      await resource.prepare?.(tx, ctx);
      const query = (request.query ?? {}) as Record<string, unknown>;
      const filter = (await resource.listFilter?.(tx, ctx.tenantId, query)) ?? {};
      if (isProblem(filter)) return invalid(filter);
      const rows = await storeOf(resource).all(tx, filter);
      return { status: 200, body: { items: rows.map(resource.reply), nextCursor: null } };
    });
    reply.code(outcome.status).send(outcome.body);
  });
  // A resource with no `create` is one row that exists from its first read (the analytics profile): no POST.
  const createSchema = resource.create;
  if (createSchema)
    app.post(base, async (request, reply) => {
      const ctx = await gate(pool, request, reply, resource.can);
      if (!ctx) return;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        const { status, body } = fieldProblem(parsed.error);
        return reply.code(status).send(body);
      }
      const target = { ctx, reply, uniqueField: resource.uniqueField, taken: resource.taken };
      await run(pool, target, (tx) => create(tx, ctx, resource, parsed.data));
    });
  // Edit, switch off and switch on are all this one PUT (`active`): the generated screen never sends DELETE.
  app.put(`${base}/:id`, async (request, reply) => {
    const ctx = await gate(pool, request, reply, resource.can);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    if (!idOrNotFound(reply, id, resource.kind)) return;
    const parsed = resource.patch.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    const target = { ctx, reply, uniqueField: resource.uniqueField, taken: resource.taken };
    await run(pool, target, (tx) => edit(tx, ctx, resource, { id, patch: parsed.data }));
  });
}

export function registerPlantSettingsRoutes(app: FastifyInstance, pool: Pool): void {
  for (const resource of [...RESOURCES, ...LIST_RESOURCES]) registerResource(app, pool, resource);
  app.get('/api/v1/machines/:id/moves', async (request, reply) => {
    const ctx = await gate(pool, request, reply);
    if (!ctx) return;
    const { id } = request.params as { id: string };
    if (!idOrNotFound(reply, id, 'machine')) return;
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
