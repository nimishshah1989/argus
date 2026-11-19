import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { machineProductionPatchSchema } from '@uptimo/shared';
import { canSettingsLists } from '@uptimo/domain';
import { fieldProblem, idOrNotFound, refuse, withTenant } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { actorOf, forbidden } from './actor.js';
import { isLeftOut, selectOne, setLeftOut } from './repo/plant-settings.js';

/**
 * `PUT /machines/:id/production-data` (ticket 77a): a head or admin switches one machine out of production data (a
 * spare-capacity machine) or back in. The machine keeps every record; the engine reads the switch (analytics `load`).
 * A change leaves one audit line with the old and new value; asking for what the machine already is leaves none.
 */
export function registerMachineProductionRoute(app: FastifyInstance, pool: Pool): void {
  app.put('/api/v1/machines/:id/production-data', async (request, reply) => {
    const ctx = await requireAuth(pool, request, reply);
    if (!ctx) return;
    if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
    const { id } = request.params as { id: string };
    if (!idOrNotFound(reply, id, 'machine')) return;
    const parsed = machineProductionPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      const { status, body } = fieldProblem(parsed.error);
      return reply.code(status).send(body);
    }
    const { excludedFromProduction } = parsed.data;
    const outcome = await withTenant(pool, ctx.tenantId, async (tx) => {
      const machine = await selectOne(tx, 'machine', id);
      if (!machine) return refuse(404, 'not_found', 'Unknown machine', 'id');
      const before = isLeftOut(machine);
      if (before !== excludedFromProduction) {
        await setLeftOut(tx, id, excludedFromProduction);
        await audit.record(tx, {
          tenantId: ctx.tenantId,
          loginId: ctx.loginId,
          supportGrantId: ctx.supportGrantId,
          action: 'machine.production_data',
          entity: 'machine',
          entityId: id,
          before: { excludedFromProduction: before },
          after: { excludedFromProduction },
        });
      }
      return { status: 200, body: { id, code: machine.code, excludedFromProduction } };
    });
    reply.code(outcome.status).send(outcome.body);
  });
}
