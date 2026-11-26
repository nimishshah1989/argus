import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

/** The refusal an operator, technician or board login gets on a save (the Why-Why roles decide, ADR 0051 A3). */
export const OEM_CAUSE_WRITE_REFUSAL =
  'Only a supervisor, head, plant head or admin may save an OEM cause';

/**
 * PUT /api/v1/tickets/:id/oem-cause: appends one oem_cause event on a closed breakdown of this plant and answers
 * the stored payload with 201. Who decided and the plant date are the session's, never the body's.
 */
export function registerOemCauseRoutes(_app: FastifyInstance, _pool: Pool): void {
  throw new Error('not implemented');
}
