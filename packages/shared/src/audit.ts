import { z } from 'zod';
import { isoDateTimeSchema } from './ticket-reply.js';

/**
 * The audit screen's contract (MILESTONES 20 goal 2; LOCK: "audit trail with CSV export", admin and head read, only
 * the admin exports). `area` is the audit entity the row names, so the screen's chips are the same words the
 * writers use (`person`, `machine`, `setting`, `ticket`, …) and an unknown word is a 422, never a silent empty list.
 */
export const AUDIT_AREAS = [
  'person',
  'login',
  'session',
  'machine',
  'segment',
  'machine_group',
  'shift',
  'list_item',
  'glossary_term',
  'asset_register',
  'roster_entry',
  'escalation_rule',
  'analytics_profile',
  'forecast',
  'setting',
  'tenant',
  'ticket',
  'sla_policy',
  'platform_access',
  'route',
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** A plant day: the date as the plant's own clock writes it, never a UTC instant. */
const plantDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the plant day as YYYY-MM-DD')
  .refine((day) => {
    const at = new Date(`${day}T00:00:00.000Z`);
    return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === day;
  }, 'That is not a real day');

const area = z.enum(AUDIT_AREAS);
const personId = z.string().uuid();
const day = plantDay.optional();

/** `GET /audit`: the filters the screen sends; `cursor` and `limit` page it. */
export const auditQuerySchema = z
  .object({
    area: area.optional(),
    personId: personId.optional(),
    from: day,
    to: day,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** `GET /audit.csv`: the same filters, without paging — the export is one bounded answer. */
export const auditExportQuerySchema = z
  .object({
    area: area.optional(),
    personId: personId.optional(),
    from: day,
    to: day,
  })
  .strict();
export type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;

/** Who made the change: the person behind the login, or the username of a shared phone; null on a grant line. */
export const auditActorSchema = z.object({ loginId: z.string(), name: z.string() }).strict();

export const auditRowSchema = z
  .object({
    id: z.string().uuid(),
    at: isoDateTimeSchema,
    action: z.string(),
    entity: z.string(),
    entityId: z.string().nullable(),
    actor: auditActorSchema.nullable(),
    /** The stored values; null when the line has none, and blanked for ever once the person is erased (D30). */
    before: z.unknown(),
    after: z.unknown(),
    ip: z.string().nullable(),
  })
  .strict();
export type AuditRow = z.infer<typeof auditRowSchema>;

export const auditPageSchema = z
  .object({ items: z.array(auditRowSchema), nextCursor: z.string().nullable() })
  .strict();
export type AuditPage = z.infer<typeof auditPageSchema>;

/** The two audit routes, spread into `REPLY_SCHEMAS`; the CSV's success body is not JSON. */
export const AUDIT_REPLIES = {
  'GET /api/v1/audit': auditPageSchema,
  'GET /api/v1/audit.csv': null,
} as const;
