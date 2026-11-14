import { z } from 'zod';

/**
 * Contracts for support access (ticket 35, D27): a customer admin lets one named member of our own staff into
 * the plant's data for a few days, sees what they did, and can end it.
 */

/** The longest a grant may run. The database refuses a longer one whatever the server sends. */
export const SUPPORT_ACCESS_MAX_DAYS = 7;

export const supportAccessCreateSchema = z
  .object({
    platformUser: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(1).max(500),
    days: z.number().int().min(1).max(SUPPORT_ACCESS_MAX_DAYS),
  })
  .strict();
export type SupportAccessCreate = z.infer<typeof supportAccessCreateSchema>;

export const supportActionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const iso = z.string().datetime({ offset: true });
const grant = {
  id: z.string().uuid(),
  platformUser: z.string(),
  reason: z.string(),
  createdAt: iso,
  expiresAt: iso,
  /** The admin's username; null only on a grant from before approval was required. */
  approvedBy: z.string().nullable(),
};
export const supportGrantSchema = z.object(grant).strict();
/** `ended` covers run out, ended by the admin, and never approved: none of them lets anyone in. */
export const supportGrantListSchema = z
  .object({ items: z.array(z.object({ ...grant, status: z.enum(['active', 'ended']) }).strict()) })
  .strict();

/** One call made (`request`) or turned away (`refused`) under a grant: the route as registered, never the address. */
export const supportActionSchema = z
  .object({
    id: z.string().uuid(),
    at: iso,
    kind: z.enum(['request', 'refused']),
    method: z.string(),
    route: z.string(),
    ip: z.string().nullable(),
  })
  .strict();
export const supportActionsPageSchema = z
  .object({ items: z.array(supportActionSchema), nextCursor: z.string().nullable() })
  .strict();

/** Reply schema of each support-access route, spread into `REPLY_SCHEMAS`. */
export const SUPPORT_ACCESS_REPLIES = {
  'POST /api/v1/support-access': supportGrantSchema,
  'GET /api/v1/support-access': supportGrantListSchema,
  'DELETE /api/v1/support-access/:id': z.object({ ok: z.literal(true) }).strict(),
  'GET /api/v1/support-access/:id/actions': supportActionsPageSchema,
} as const;
