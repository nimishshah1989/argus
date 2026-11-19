import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import {
  calendarDay,
  nudgeAcceptSchema,
  nudgeAckBodySchema,
  type AnalyticsProfile,
  type NudgeAcceptBody,
  type NudgeAckBody,
  type NudgeTicketReply,
} from '@uptimo/shared';
import {
  actionCenterBoard,
  canAnalytics,
  canRaise,
  type ActionCenterBoard,
  type EngineData,
  type NudgeAck,
} from '@uptimo/domain';
import { fieldProblem, refuse, withTenant, type Refusal } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import {
  actorOf,
  forbidden,
  plantToday,
  removeNudgeAck,
  saveNudgeAck,
  selectNudgeAck,
  selectNudgeAcks,
} from '../plant/index.js';
import { raisePlannedTicket, raisedTicketsFor } from '../tickets/index.js';

type Db = Pick<PoolClient, 'query'>;
/** Who a write acts for: the tenant and the login, with the person behind it (the accepted nudge's reporter). */
type Ctx = {
  tenantId: string;
  loginId: string;
  personId: string | null;
  supportGrantId?: string | null;
};
/** A refusal or a fresh board, the same shape the settings resources return to their routes. */
type Outcome = Refusal;
/** A refusal, or the ticket an accepted nudge answers. */
type AcceptOutcome = Refusal | { status: number; body: NudgeTicketReply };

/** The prefix of the one `setting` row each nudge keeps: the rest of the key is the platform's nudge key. */
const NUDGE_PREFIX = 'nudge:';
const DAY_MS = 86_400_000;
const ACTION: Record<NudgeAck['status'], string> = {
  ack: 'nudge.ack',
  snooze: 'nudge.snooze',
  done: 'nudge.resolve',
};

/** The board a write reads and answers: the plant's loaded rows, the profile and the board cut from them. */
export interface NudgeBoardState {
  board: ActionCenterBoard;
  data: EngineData;
  profile: AnalyticsProfile;
}

/**
 * How this module sees the plant: the loader and the profile, injected by the route module so this file reads no
 * table of its own and the two modules stay acyclic (the loader reads the acks through `readNudgeAcks`).
 */
export type NudgeBoardOf = (tx: Db, tenantId: string, asOf: string) => Promise<NudgeBoardState>;

/** Every stored acknowledgement, by the platform's nudge key (the `nudge:` prefix removed). */
export async function readNudgeAcks(tx: Db): Promise<Record<string, NudgeAck>> {
  const rows = await selectNudgeAcks(tx);
  return Object.fromEntries(
    rows.map((row) => [row.key.slice(NUDGE_PREFIX.length), row.value as NudgeAck]),
  );
}

/** 422 naming `asOf` when it is not a plant date; null when it was left empty. */
function asOfProblem(asOf: unknown): Refusal | null {
  if (asOf === undefined) return null;
  if (typeof asOf === 'string' && calendarDay.safeParse(asOf).success) return null;
  return refuse(422, 'validation', 'Use a date like 2026-11-14', 'asOf');
}

/** The stored record a write saves: the screen's `resolved` is the store's `done`, and a snooze carries its day. */
function ackOf(body: NudgeAckBody, snoozeDays: number, at: Date): NudgeAck {
  const status = body.status === 'resolved' ? 'done' : body.status;
  const ack: NudgeAck = {
    status,
    owner: body.owner ?? '',
    due: body.due ?? '',
    note: body.note ?? '',
    at: at.toISOString(),
  };
  if (status === 'snooze') ack.until = new Date(at.getTime() + snoozeDays * DAY_MS).toISOString();
  return ack;
}

/** The plant's rows with one nudge's ack replaced (or, with null, removed): the board a write answers. */
function boardAfter(state: NudgeBoardState, key: string, ack: NudgeAck | null): ActionCenterBoard {
  const settings = state.data.settings ?? { excludedMachineIds: [], problemFixes: {} };
  const nudgeAcks = { ...(settings.nudgeAcks ?? {}) };
  if (ack === null) delete nudgeAcks[key];
  else nudgeAcks[key] = ack;
  const data: EngineData = { ...state.data, settings: { ...settings, nudgeAcks } };
  return actionCenterBoard({ data, asOf: state.board.asOf, profile: state.profile });
}

/**
 * The current nudge a key names, or a 404. A good-news nudge is a lookup success: what it refuses depends on the
 * action (acknowledge, raise), so each caller answers that 409 itself.
 */
function nudgeFor(
  state: NudgeBoardState,
  key: string,
): { nudge: ActionCenterBoard['nudges'][number] } | Refusal {
  const nudge = state.board.nudges.find((candidate) => candidate.key === key);
  if (!nudge) return refuse(404, 'not_found', 'Unknown nudge', 'key');
  return { nudge };
}

/** A good-news nudge has nothing to acknowledge and nothing to raise: the one 409, worded for the action. */
function goodNews(action: 'acknowledge' | 'raise'): Refusal {
  return refuse(409, 'conflict', `Good news has nothing to ${action}`, 'key');
}

const isRefusal = (value: object): value is Refusal => 'status' in value && 'body' in value;

/**
 * Acknowledge, snooze or resolve one current, open nudge: the stored record, one audit line naming the row and the
 * change, and the fresh board. `at` is the database's own `now()`; a snooze's `until` adds the profile's
 * `snoozeDays`, read in this same transaction, so a plant that shortens its snooze changes the next one.
 */
async function writeNudge(
  tx: PoolClient,
  input: { ctx: Ctx; key: string; body: NudgeAckBody },
  boardOf: NudgeBoardOf,
): Promise<Outcome> {
  const { ctx, key, body } = input;
  const today = await plantToday(tx, ctx.tenantId);
  const state = await boardOf(tx, ctx.tenantId, today);
  const found = nudgeFor(state, key);
  if (isRefusal(found)) return found;
  if (found.nudge.sev === 'info') return goodNews('acknowledge');
  if (found.nudge.status !== 'open')
    return refuse(409, 'conflict', 'This nudge is not open; reopen it first', 'key');
  const at = (await tx.query('SELECT now() AS at')).rows[0].at as Date;
  const ack = ackOf(body, state.profile.snoozeDays, at);
  const rowKey = `${NUDGE_PREFIX}${key}`;
  const existing = await selectNudgeAck(tx, rowKey);
  const row = await saveNudgeAck(tx, { tenantId: ctx.tenantId, key: rowKey, value: ack });
  await audit.record(tx, {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    supportGrantId: ctx.supportGrantId,
    action: ACTION[ack.status],
    entity: 'setting',
    entityId: row.id,
    before: existing?.value ?? null,
    after: ack,
  });
  return { status: 200, body: boardAfter(state, key, ack) };
}

/** Reopen one current nudge: the row goes, one audit line keeps what it held, and the fresh board answers. */
async function reopenNudge(
  tx: PoolClient,
  ctx: Ctx,
  key: string,
  boardOf: NudgeBoardOf,
): Promise<Outcome> {
  const today = await plantToday(tx, ctx.tenantId);
  const state = await boardOf(tx, ctx.tenantId, today);
  const found = nudgeFor(state, key);
  if (isRefusal(found)) return found;
  if (found.nudge.sev === 'info') return goodNews('acknowledge');
  const removed = await removeNudgeAck(tx, `${NUDGE_PREFIX}${key}`);
  if (removed !== undefined)
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      loginId: ctx.loginId,
      supportGrantId: ctx.supportGrantId,
      action: 'nudge.reopen',
      entity: 'setting',
      entityId: removed.id,
      before: removed.value,
      after: null,
    });
  return { status: 200, body: boardAfter(state, key, null) };
}

/**
 * The machine the nudge's ticket names (R17): a nudge with one machine needs no choice, a nudge with several
 * needs one of its own, and a nudge that names no machine has nothing to raise at all.
 */
function machineFor(
  nudge: ActionCenterBoard['nudges'][number],
  chosen: string | undefined,
): string | Refusal {
  if (nudge.machines.length === 0)
    return refuse(422, 'validation', 'This nudge names no machine', 'key');
  if (chosen === undefined) {
    if (nudge.machines.length === 1) return nudge.machines[0]!;
    return refuse(422, 'validation', 'Choose a machine from this nudge', 'machineId');
  }
  if (!nudge.machines.includes(chosen))
    return refuse(422, 'validation', 'That machine is not in this nudge', 'machineId');
  return chosen;
}

/**
 * Accept one current nudge as a linked inspection ticket (52 packet 3, R17): the ticket is raised through the
 * tickets module's published seam with `{source:{nudge:<key>}}` on its raise event (R16), the nudge is resolved
 * with the accept's own record, and one `nudge.accept` line names both. It is idempotent for the key's lifetime:
 * an already-linked nudge answers that same ticket with `created:false` and writes nothing — the link is checked
 * before the machine choice and before any ack status, so a snoozed or resolved nudge keeps its one ticket.
 */
async function acceptNudge(
  tx: PoolClient,
  input: { ctx: Ctx; key: string; body: NudgeAcceptBody },
  boardOf: NudgeBoardOf,
): Promise<AcceptOutcome> {
  const { ctx, key, body } = input;
  const today = await plantToday(tx, ctx.tenantId);
  const state = await boardOf(tx, ctx.tenantId, today);
  const found = nudgeFor(state, key);
  if (isRefusal(found)) return found;
  if (found.nudge.sev === 'info') return goodNews('raise');
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `nudge-accept:${ctx.tenantId}:${key}`,
  ]);
  const linked = (await raisedTicketsFor(tx, ctx.tenantId, 'nudge', [key])).get(key);
  if (linked)
    return { status: 200, body: { ticketId: linked.id, ref: linked.ref, created: false } };
  const machine = machineFor(found.nudge, body.machineId);
  if (typeof machine !== 'string') return machine;
  const at = (await tx.query('SELECT now() AS at')).rows[0].at as Date;
  const raised = await raisePlannedTicket(tx, {
    tenantId: ctx.tenantId,
    machineId: machine,
    channel: 'inspection',
    problem: found.nudge.title,
    reportedByPersonId: ctx.personId,
    raisedLoginId: ctx.loginId,
    at,
    source: { nudge: key },
  });
  const rowKey = `${NUDGE_PREFIX}${key}`;
  const existing = await selectNudgeAck(tx, rowKey);
  const ack: NudgeAck = { status: 'done', owner: '', due: '', note: '', at: at.toISOString() };
  await saveNudgeAck(tx, { tenantId: ctx.tenantId, key: rowKey, value: ack });
  await audit.record(tx, {
    tenantId: ctx.tenantId,
    loginId: ctx.loginId,
    supportGrantId: ctx.supportGrantId,
    action: 'nudge.accept',
    entity: 'ticket',
    entityId: raised.id,
    before: existing?.value ?? null,
    after: { key, ticketId: raised.id, ref: raised.ref, ack },
  });
  return { status: 200, body: { ticketId: raised.id, ref: raised.ref, created: true } };
}

/**
 * The screen's reads and writes (ticket 44, packet 44c), all for the analytics audience (`canAnalytics`: a
 * supervisor acts on a nudge; an operator and the board login do not see them). The GET defaults to the plant's today;
 * the write and the reopen answer the whole fresh board so the screen never patches its own copy. The accept (52
 * packet 3) raises the nudge's inspection ticket and answers the link instead of the board.
 */
export function registerNudgeRoutes(app: FastifyInstance, pool: Pool, boardOf: NudgeBoardOf): void {
  app.get('/api/v1/analytics/action-center', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const asked = (request.query as { asOf?: string }).asOf;
    const problem = asOfProblem(asked);
    if (problem) return reply.code(problem.status).send(problem.body);
    const board = await withTenant(pool, ctx.tenantId, async (tx) => {
      const asOf = asked ?? (await plantToday(tx, ctx.tenantId));
      return (await boardOf(tx, ctx.tenantId, asOf)).board;
    });
    reply.send(board);
  });
  app.put('/api/v1/analytics/action-center/nudges/:key', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const parsed = nudgeAckBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    const key = (request.params as { key: string }).key;
    const outcome = await withTenant(pool, ctx.tenantId, (tx) =>
      writeNudge(tx, { ctx, key, body: parsed.data }, boardOf),
    );
    reply.code(outcome.status).send(outcome.body);
  });
  app.delete('/api/v1/analytics/action-center/nudges/:key', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const key = (request.params as { key: string }).key;
    const outcome = await withTenant(pool, ctx.tenantId, (tx) =>
      reopenNudge(tx, ctx, key, boardOf),
    );
    reply.code(outcome.status).send(outcome.body);
  });
  /**
   * Accept a nudge into one linked inspection ticket (52 packet 3, R17): a supervisor or above may accept (and may
   * raise: `canRaise` refuses only the board login). The body names a machine only when the nudge names several.
   */
  app.post('/api/v1/analytics/action-center/nudges/:key/ticket', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const actor = actorOf(ctx);
    if (!canAnalytics(actor) || !canRaise(actor)) return forbidden(reply);
    const parsed = nudgeAcceptSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    const key = (request.params as { key: string }).key;
    const outcome = await withTenant(pool, ctx.tenantId, (tx) =>
      acceptNudge(tx, { ctx, key, body: parsed.data }, boardOf),
    );
    reply.code(outcome.status).send(outcome.body);
  });
}
