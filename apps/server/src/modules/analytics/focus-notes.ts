import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { FocusNoteBody, FocusNotesReply } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;
/** Who a write acts for: the tenant and the login (the audit line names both). */
type Ctx = { tenantId: string; loginId: string; supportGrantId?: string | null };

/**
 * Team Focus notes (ticket TF-1, ADR 0018): the month's notes by the engine's action key, read from the `setting`
 * rows under `focus:<period>|` (the action key is the rest of the row key, `|` and all).
 */
export async function readFocusNotes(_tx: Db, _period: string): Promise<FocusNotesReply> {
  throw new Error('not built');
}

/**
 * Save one action's note: `at` is the database's `now()`, a left-out owner or note is saved empty, the one row per
 * action is upserted (its id kept), one `focus.save` audit line names the row with before/after, and the month's
 * fresh notes answer.
 */
export async function writeFocusNote(
  _tx: PoolClient,
  _input: { ctx: Ctx; body: FocusNoteBody },
): Promise<FocusNotesReply> {
  throw new Error('not built');
}

/**
 * `GET /analytics/team-focus/notes?period=YYYY-MM` and `PUT /analytics/team-focus/notes`: the analytics audience
 * (`canAnalytics`: supervisor, heads, admin) reads and writes; everyone else gets 403.
 */
export function registerFocusNoteRoutes(app: FastifyInstance, _pool: Pool): void {
  app.get('/api/v1/analytics/team-focus/notes', async () => {
    throw new Error('not built');
  });
  app.put('/api/v1/analytics/team-focus/notes', async () => {
    throw new Error('not built');
  });
}
