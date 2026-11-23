import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

/**
 * `GET /api/v1/analytics/compare?a=<code>&b=<code>&asOf=YYYY-MM-DD` (ticket 585, ADR 0020 §1, §4): the engine's Compare
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
export function registerCompareRoute(app: FastifyInstance, pool: Pool): void {
  void pool;
  app.get('/api/v1/analytics/compare', async () => {
    throw new Error('not built');
  });
}
