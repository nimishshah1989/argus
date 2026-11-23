import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import {
  focusNoteBodySchema,
  focusPeriodSchema,
  focusRowKey,
  type FocusNote,
  type FocusNoteBody,
  type FocusNotesReply,
} from '@uptimo/shared';
import { canAnalytics } from '@uptimo/domain';
import { fieldProblem, refuse, withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import {
  actorOf,
  forbidden,
  saveNudgeAck,
  selectFocusNotes,
  selectNudgeAck,
} from '../plant/index.js';

type Db = Pick<PoolClient, 'query'>;
/** Who a write acts for: the tenant and the login (the audit line names both). */
type Ctx = { tenantId: string; loginId: string; supportGrantId?: string | null };

/**
 * Team Focus notes (ticket TF-1, ADR 0018): the month's notes by the engine's action key, read from the `setting`
 * rows under `focus:<period>|` (the action key is the rest of the row key, `|` and all).
 */
export async function readFocusNotes(tx: Db, period: string): Promise<FocusNotesReply> {
  const prefix = focusRowKey(period, '');
  const rows = await selectFocusNotes(tx, period);
  return {
    period,
    notes: Object.fromEntries(
      rows.map((row) => [row.key.slice(prefix.length), row.value as FocusNote]),
    ),
  };
}

/**
 * Save one action's note: `at` is the database's `now()`, a left-out owner or note is saved empty, the one row per
 * action is upserted (its id kept), one `focus.save` audit line names the row with before/after, and the month's
 * fresh notes answer.
 */
export async function writeFocusNote(
  tx: PoolClient,
  input: { ctx: Ctx; body: FocusNoteBody },
): Promise<FocusNotesReply> {
  const { ctx, body } = input;
  const at = (await tx.query('SELECT now() AS at')).rows[0].at as Date;
  const note: FocusNote = {
    status: body.status,
    owner: body.owner ?? '',
    note: body.note ?? '',
    at: at.toISOString(),
  };
  const key = focusRowKey(body.period, body.action);
  const existing = await selectNudgeAck(tx, key);
  const row = await saveNudgeAck(tx, { tenantId: ctx.tenantId, key, value: note });
  await audit.record(tx, {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    supportGrantId: ctx.supportGrantId,
    action: 'focus.save',
    entity: 'setting',
    entityId: row.id,
    before: existing?.value ?? null,
    after: note,
  });
  return readFocusNotes(tx, body.period);
}

/**
 * `GET /analytics/team-focus/notes?period=YYYY-MM` and `PUT /analytics/team-focus/notes`: the analytics audience
 * (`canAnalytics`: supervisor, heads, admin) reads and writes; everyone else gets 403.
 */
export function registerFocusNoteRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/analytics/team-focus/notes', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const period = focusPeriodSchema.safeParse((request.query as { period?: unknown }).period);
    if (!period.success) {
      const { status, body } = refuse(422, 'validation', 'Use a month like 2026-12', 'period');
      return reply.code(status).send(body);
    }
    reply.send(await withTenant(pool, ctx.tenantId, (tx) => readFocusNotes(tx, period.data)));
  });
  app.put('/api/v1/analytics/team-focus/notes', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const parsed = focusNoteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    reply.send(
      await withTenant(pool, ctx.tenantId, (tx) => writeFocusNote(tx, { ctx, body: parsed.data })),
    );
  });
}
