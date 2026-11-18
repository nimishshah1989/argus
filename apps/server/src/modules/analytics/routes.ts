import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { ZodError } from 'zod';
import {
  apiError,
  calendarDay,
  drillQuerySchema,
  MAX_DRILL_IDS,
  PROFILE_FIELDS,
  PROFILE_KEYS,
  type AnalyticsProfile,
  type DrillReply,
  type DrillReplyRow,
  type DrillType,
  type FiguresReply,
} from '@uptimo/shared';
import {
  actionCenterBoard,
  canAnalytics,
  canMoney,
  FIGURES,
  type ActorContext,
  type EngineData,
} from '@uptimo/domain';
import { withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf, forbidden, plantToday, registerResource } from '../plant/index.js';
import { loadEngineData } from './load.js';
import { registerNudgeRoutes, type NudgeBoardOf } from './nudges.js';
import { profileResource, readProfile } from './profile.js';
import { notStored, runForTenant, type FigureStore } from './service.js';
import { snapshotStore } from './snapshot.js';

const MONEY = new Set(FIGURES.filter((figure) => figure.money).map((figure) => figure.key));

/** The screen's board, cut from one load of the plant and the profile read in the same transaction. */
const boardOf: NudgeBoardOf = async (tx, tenantId, asOf) => {
  const data = await loadEngineData(tx, tenantId);
  const profile = await readProfile(tx, tenantId);
  return { data, profile, board: actionCenterBoard({ data, asOf, profile }) };
};

/** The money numbers of the profile are null for anyone but heads and admin. */
function shownProfile(profile: AnalyticsProfile, money: boolean): FiguresReply['profile'] {
  return Object.fromEntries(
    PROFILE_KEYS.map((key) => [key, !money && PROFILE_FIELDS[key].money ? null : profile[key]]),
  ) as FiguresReply['profile'];
}

/** A run's reply: the figures the caller may see, and the profile with its money fields hidden. */
async function figuresReply(input: {
  pool: Pool;
  tenantId: string;
  money: boolean;
  asked: string | undefined;
  store: FigureStore;
}): Promise<FiguresReply> {
  const { pool, tenantId, money, asked, store } = input;
  const result = await withTenant(pool, tenantId, async (tx) =>
    runForTenant(tx, { tenantId, asOf: asked ?? (await plantToday(tx, tenantId)), store }),
  );
  return {
    ...result,
    profile: shownProfile(result.profile, money),
    figures: result.figures.filter((figure) => money || !MONEY.has(figure.key)),
  };
}

/** 422 on an `asOf` that is not a real plant date; null when it was left empty. */
function dateProblem(asOf: unknown) {
  if (asOf === undefined) return null;
  if (typeof asOf === 'string' && calendarDay.safeParse(asOf).success) return null;
  return apiError('validation', 'Use a date like 2026-11-14', 'asOf');
}

/** A run stores money figures, so it is heads and admin only; the refusal says which permission is missing. */
function runRefused(reply: FastifyReply, actor: ActorContext): void {
  const message = canAnalytics(actor)
    ? 'Only a head, plant head or admin may store a run'
    : 'You do not have permission to run the analytics engine';
  reply.code(403).send(apiError('forbidden', message));
}

/** A task's ticket part: the extra task fields never reach a drill reply, which carries ticket rows only. */
function asTicket(task: EngineData['tasks'][number]): EngineData['tickets'][number] {
  const { parentId, reason, expectedOn, ...ticket } = task;
  return ticket;
}

/**
 * The rows of one drill type. Tasks are tickets too: they drill as the ticket row the reply carries. The loader's
 * optional nameplate fields become the null the reply contract names, so the strict schema still sees every key.
 */
function drillRows(data: EngineData, type: DrillType): DrillReplyRow[] {
  if (type === 'machine')
    return data.machines.map((machine) => ({
      ...machine,
      serial: machine.serial ?? null,
      controllerModel: machine.controllerModel ?? null,
      controllerSerial: machine.controllerSerial ?? null,
    }));
  if (type === 'move')
    return data.moves.map((move) => ({
      ...move,
      fromLocation: move.fromLocation ?? null,
      toLocation: move.toLocation ?? null,
    }));
  return [...data.tickets, ...data.tasks.map(asTicket)];
}

/**
 * The asked rows of a drill-down: one load of the plant, then a lookup by id in the order asked. An id of another
 * plant, another type or no row at all is dropped: a figure's drill target that vanished is not an error.
 * shortcut: drills load the whole plant once per request; switch to narrow repo reads by id when a plant's load passes about a second.
 */
async function drillReply(
  pool: Pool,
  tenantId: string,
  type: DrillType,
  ids: readonly string[],
): Promise<DrillReply> {
  const rows = await withTenant(pool, tenantId, async (tx) => {
    const data = await loadEngineData(tx, tenantId);
    const byId = new Map(drillRows(data, type).map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    });
  });
  return { type, rows };
}

/** 422 naming the query field to correct: the type, or the ids. */
function drillProblem(error: ZodError) {
  if (error.issues[0]?.path[0] === 'type') {
    return apiError('validation', 'Use a drill type: machine, ticket or move', 'type');
  }
  return apiError('validation', `Ask for 1 to ${MAX_DRILL_IDS} ids like ?ids=<id>,<id>`, 'ids');
}

/**
 * `GET /analytics/figures?asOf=YYYY-MM-DD` (default: the plant's today): the registry's figures as of one date,
 * with the profile used. Supervisor, heads and admin read it (DOMAIN §3). Money is for heads and admin: for
 * anyone else the money numbers of the profile are null and the money figures are left out. A kiosk head login
 * counts as a head, like every other money check. The run is read-only and costs one pass over the plant's rows
 * per request (see the PR's known follow-ups: serve from `kpi_snapshot` once it exists).
 *
 * `POST /analytics/run` runs the same engine and stores one `kpi_snapshot` for the day, replying the same shape.
 * Only heads and admin may store a run (a stored day carries money figures). The GET never writes.
 *
 * `GET /analytics/drill?type&ids` answers the rows behind one figure, in the order asked.
 */
export function registerAnalyticsRoutes(app: FastifyInstance, pool: Pool): void {
  registerResource(app, pool, profileResource);
  registerNudgeRoutes(app, pool, boardOf);
  app.get('/api/v1/analytics/figures', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const actor = actorOf(ctx);
    if (!canAnalytics(actor)) return forbidden(reply);
    const asked = (request.query as { asOf?: string }).asOf;
    const problem = dateProblem(asked);
    if (problem) return reply.code(422).send(problem);
    reply.send(
      await figuresReply({
        pool,
        tenantId: ctx.tenantId,
        money: canMoney(actor),
        asked,
        store: notStored,
      }),
    );
  });
  app.post('/api/v1/analytics/run', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const actor = actorOf(ctx);
    if (!canAnalytics(actor) || !canMoney(actor)) return runRefused(reply, actor);
    const asked = (request.body as { asOf?: unknown } | undefined)?.asOf;
    const problem = dateProblem(asked);
    if (problem) return reply.code(422).send(problem);
    reply.send(
      await figuresReply({
        pool,
        tenantId: ctx.tenantId,
        money: true,
        asked: asked as string | undefined,
        store: snapshotStore,
      }),
    );
  });
  app.get('/api/v1/analytics/drill', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
    const parsed = drillQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(drillProblem(parsed.error));
    reply.send(await drillReply(pool, ctx.tenantId, parsed.data.type, parsed.data.ids));
  });
}
