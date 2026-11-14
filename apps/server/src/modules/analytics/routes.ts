import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import {
  apiError,
  calendarDay,
  PROFILE_FIELDS,
  PROFILE_KEYS,
  type AnalyticsProfile,
  type FiguresReply,
} from '@uptimo/shared';
import { canAnalytics, canMoney, FIGURES } from '@uptimo/domain';
import { withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { actorOf, forbidden, plantToday, registerResource } from '../plant/index.js';
import { profileResource } from './profile.js';
import { runForTenant } from './service.js';

const MONEY = new Set(FIGURES.filter((figure) => figure.money).map((figure) => figure.key));

/** The money numbers of the profile are null for anyone but heads and admin. */
function shownProfile(profile: AnalyticsProfile, money: boolean): FiguresReply['profile'] {
  return Object.fromEntries(
    PROFILE_KEYS.map((key) => [key, !money && PROFILE_FIELDS[key].money ? null : profile[key]]),
  ) as FiguresReply['profile'];
}

/**
 * `GET /analytics/figures?asOf=YYYY-MM-DD` (default: the plant's today): the registry's figures as of one date,
 * with the profile used. Supervisor, heads and admin read it (DOMAIN §3). Money is for heads and admin: for
 * anyone else the money numbers of the profile are null and the money figures are left out. A kiosk head login
 * counts as a head, like every other money check. The run is read-only and costs one pass over the plant's rows
 * per request (see the PR's known follow-ups: serve from `kpi_snapshot` once it exists).
 */
export function registerAnalyticsRoutes(app: FastifyInstance, pool: Pool): void {
  registerResource(app, pool, profileResource);
  app.get('/api/v1/analytics/figures', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    const actor = actorOf(ctx);
    if (!canAnalytics(actor)) return forbidden(reply);
    const asked = (request.query as { asOf?: string }).asOf;
    if (asked !== undefined && !calendarDay.safeParse(asked).success) {
      return reply.code(422).send(apiError('validation', 'Use a date like 2026-11-14', 'asOf'));
    }
    const result = await withTenant(pool, ctx.tenantId, async (tx) =>
      runForTenant(tx, {
        tenantId: ctx.tenantId,
        asOf: asked ?? (await plantToday(tx, ctx.tenantId)),
      }),
    );
    const money = canMoney(actor);
    const body: FiguresReply = {
      ...result,
      profile: shownProfile(result.profile, money),
      figures: result.figures.filter((figure) => money || !MONEY.has(figure.key)),
    };
    reply.send(body);
  });
}
