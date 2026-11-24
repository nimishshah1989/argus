import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { compareQuerySchema, type CompareReply } from '@uptimo/shared';
import { canAnalytics, canMoney, comparePair } from '@uptimo/domain';
import { refuse, withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf, forbidden, plantToday } from '../plant/index.js';
import { loadEngineData } from './load.js';
import { readProfile } from './profile.js';

/**
 * `GET /api/v1/analytics/compare?a=<code>&b=<code>&asOf=YYYY-MM-DD` (ticket 585, ADR 0021 §1, §4): the engine's Compare
 * page for any two machines of one category, the codes the picker offers, each machine's year so far, and the value of
 * a machine hour for money roles only. Contract: `compareReplySchema` (`packages/shared/src/compare-pair.ts`).
 *
 * - Auth as `/analytics/figures`: `requireAuth`, then `canAnalytics` or 403.
 * - 422 through `refuse(422, 'validation', message, field)`: a bad `asOf` → field `asOf` ("Use a date like 2026-11-14");
 *   `a` without `b` → `b`, `b` without `a` → `a`; `comparePair` answering `unknown` → its field ("Choose two machines
 *   of the same kind").
 * - In one `withTenant`: `asOf` = asked or `plantToday(tx, tenantId)`; `loadEngineData(tx, tenantId)`;
 *   `readProfile(tx, tenantId)`; `comparePair({ data, asOf, profile }, pair)`.
 * - `figure` = `{ key: 'compare', screen: 'compare', owner: 43, status: 'ready', value, drill: { type: 'machine', ids } }`;
 *   `none` → value null, ids [], `pair` null, `options` [], `years` null.
 * - Money (`canMoney`): `rate` = `profile.mmThroughput`; anyone else gets `rate: null` and the "Health checkup" table
 *   without its rows whose first cell starts with "Spares cost" (and its `rowCount` matching).
 * shortcut: one whole-plant load per request, like the drill; serve from the kept run if a plant's load passes a second.
 */

type Table = { title: string; rows: string[][]; rowCount: number };
type Page = { tables: Table[] };

/** The 422 for a query that is not `a` and `b` together with an optional date, or null when it is fine. */
function queryProblem(query: unknown) {
  const parsed = compareQuerySchema.safeParse(query);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? 'asOf');
    const message =
      field === 'asOf' ? 'Use a date like 2026-11-14' : 'Choose two machines of the same kind';
    return { problem: refuse(422, 'validation', message, field) };
  }
  const { a, b } = parsed.data;
  if ((a === undefined) !== (b === undefined)) {
    const field = a === undefined ? 'a' : 'b';
    return { problem: refuse(422, 'validation', 'Choose two machines of the same kind', field) };
  }
  return { query: parsed.data };
}

/** Without the money cut, the checkup table loses its "Spares cost" rows. */
function withoutSpares(value: unknown): unknown {
  const shown = value as { pages: Page[] };
  const pages = shown.pages.map((page) => ({
    ...page,
    tables: page.tables.map((table) => {
      if (table.title !== 'Health checkup') return table;
      const rows = table.rows.filter((row) => !row[0]?.startsWith('Spares cost'));
      return { ...table, rows, rowCount: rows.length };
    }),
  }));
  return { ...shown, pages };
}

export function registerCompareRoute(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/analytics/compare', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const actor = actorOf(ctx);
    if (!canAnalytics(actor)) return forbidden(reply);
    const checked = queryProblem(request.query);
    if (checked.problem) return reply.code(checked.problem.status).send(checked.problem.body);
    const { a, b, asOf: asked } = checked.query;
    const money = canMoney(actor);
    const out = await withTenant(pool, ctx.tenantId, async (tx) => {
      const asOf = asked ?? (await plantToday(tx, ctx.tenantId));
      const data = await loadEngineData(tx, ctx.tenantId);
      const profile = await readProfile(tx, ctx.tenantId);
      return { asOf, profile, result: comparePair({ data, asOf, profile }, a && b ? { a, b } : undefined) };
    });
    const { asOf, profile, result } = out;
    if (result.kind === 'unknown') {
      const { status, body } = refuse(
        422,
        'validation',
        'Choose two machines of the same kind',
        result.field,
      );
      return reply.code(status).send(body);
    }
    const page = result.kind === 'page';
    const figure = {
      key: 'compare',
      screen: 'compare',
      owner: 43,
      status: 'ready',
      value: page ? (money ? result.value : withoutSpares(result.value)) : null,
      drill: { type: 'machine', ids: page ? result.drillIds : [] },
    };
    const body = {
      asOf,
      pair: page ? result.pair : null,
      options: page ? result.options : [],
      figure,
      years: page ? result.years : null,
      rate: money ? profile.mmThroughput : null,
    };
    reply.send(body as CompareReply);
  });
}
