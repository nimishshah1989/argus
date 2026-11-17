import { z } from 'zod';
import {
  drillReplySchema,
  figuresReplySchema,
  profilePageSchema,
  profileReplySchema,
} from './analytics.js';
import { boardTodayReplySchema } from './board.js';
import { signoffFeedReplySchema } from './signoff.js';
import {
  actingChoicesReplySchema,
  brandReplySchema,
  loginReplySchema,
  meReplySchema,
} from './auth.js';
import {
  LIST_NAMES,
  listRowSchema,
  missingTranslationSchema,
  plantConfigSchema,
  settingRowSchema,
} from './config.js';
import {
  rosterCopyReplySchema,
  rosterReplySchema,
  ruleReplySchema,
} from './escalation-settings.js';
import { PEOPLE_REPLIES } from './people.js';
import {
  glossaryReplySchema,
  groupReplySchema,
  listItemReplySchema,
  logoReplySchema,
  machineMoveReplySchema,
  machineReplySchema,
  segmentReplySchema,
  settingsPage,
  shiftReplySchema,
} from './plant-settings.js';
import { pushKeyReplySchema, pushSentReplySchema } from './push.js';
import { lockoutSchema } from './lockout.js';
import { handbackSchema, slaPolicySchema, slaProjectionSchema } from './sla.js';
import { taskParentSchema, taskRowSchema, taskSummarySchema } from './tasks.js';
import { SUPPORT_ACCESS_REPLIES } from './support-access.js';
import { AUDIT_REPLIES } from './audit.js';
import { COMMAND_ACTIONS } from './ticket.js';
import {
  escalationStateSchema,
  isoDateTimeSchema,
  storedReportSchema,
  ticketEventSchema,
  ticketIntervalSchema,
  ticketPersonSchema,
  ticketSchema,
} from './ticket-reply.js';

export { errorBodySchema } from './error.js';

export const okReplySchema = z.object({ ok: z.literal(true) }).strict();
export const devicesReplySchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          device: z.string().nullable(),
          current: z.boolean(),
          lastSeenAt: isoDateTimeSchema,
          createdAt: isoDateTimeSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const healthReplySchema = z.union([
  z.object({ status: z.literal('ok') }).strict(),
  z.object({ status: z.literal('down'), db: z.boolean(), queue: z.boolean() }).strict(),
]);
/**
 * A ticket as every reply carries it: tickets' fields, then accountability's `sla`, `handback` and `canAcknowledge`
 * parts. `canAcknowledge` is about the person using the session: true only when they may acknowledge this ticket now.
 */
export const ticketReplySchema = ticketSchema
  .extend({
    sla: slaProjectionSchema.nullable(),
    handback: handbackSchema.nullable(),
    canAcknowledge: z.boolean(),
    /** Optional so a client that builds a reply by hand may leave it out; the server always sends it. */
    escalation: escalationStateSchema.optional(),
    lockout: lockoutSchema.nullable().optional(),
  })
  .strict();
export const stateReplySchema = z
  .object({
    open: z.array(ticketReplySchema),
    needReport: z.array(ticketReplySchema),
    now: isoDateTimeSchema,
  })
  .strict();
export const ticketPageSchema = z
  .object({ items: z.array(ticketReplySchema), nextCursor: z.string().nullable() })
  .strict();
/** `task` is set only when a close left a follow-up task: the new ticket's id and reference. */
export const commandReplySchema = z
  .object({
    ticket: ticketReplySchema,
    task: z.object({ id: z.string(), ref: z.string() }).strict().optional(),
  })
  .strict();
export const ticketDetailSchema = z
  .object({
    ticket: ticketReplySchema,
    events: z.array(ticketEventSchema),
    people: z.array(ticketPersonSchema),
    /** Follow-up tasks left from this ticket, oldest reference first; cancelled ones are not listed. */
    tasks: z.array(taskRowSchema),
    taskSummary: taskSummarySchema,
    /** Set when this ticket is itself a follow-up task: the breakdown it was left from. */
    parent: taskParentSchema.nullable(),
    intervals: z.array(ticketIntervalSchema),
    report: storedReportSchema.nullable(),
  })
  .strict();
/** `/config`: plant's fields, then accountability's `slaPolicies` part, then the fingerprint. */
export const configReplySchema = plantConfigSchema
  .extend({ slaPolicies: z.array(slaPolicySchema.strict()), fp: z.string() })
  .strict();
export const configSameSchema = z.object({ same: z.literal(true), fp: z.string() }).strict();

export type Ticket = z.infer<typeof ticketReplySchema>;
export type State = z.infer<typeof stateReplySchema>;
export type TicketPage = z.infer<typeof ticketPageSchema>;
export type CommandReply = z.infer<typeof commandReplySchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
export type Config = z.infer<typeof configReplySchema>;

const P = '/api/v1';
const commands = Object.fromEntries(
  ['', ...COMMAND_ACTIONS.map((a) => `/${a}`)].map((a) => [
    `POST ${P}/tickets${a ? `/:id${a}` : ''}`,
    commandReplySchema,
  ]),
);
/** Settings screens (tickets 22, 23): list, create and `PUT /:id` (edit, switch off, switch on) share one row shape. */
const settingsResource = (path: string, schema: z.ZodTypeAny) => ({
  [`GET ${P}/${path}`]: settingsPage(schema),
  [`POST ${P}/${path}`]: schema,
  [`PUT ${P}/${path}/:id`]: schema,
});
const ok = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, okReplySchema]));

/** `METHOD /fastify/url` → schema of a non-error reply; `null` = binary success body. */
export const REPLY_SCHEMAS: Readonly<Record<string, z.ZodTypeAny | null>> = {
  [`GET ${P}/health`]: healthReplySchema,
  [`GET ${P}/brand`]: brandReplySchema,
  [`POST ${P}/auth/login`]: loginReplySchema,
  [`GET ${P}/auth/me`]: meReplySchema,
  [`GET ${P}/auth/sessions`]: devicesReplySchema,
  [`GET ${P}/auth/acting`]: actingChoicesReplySchema,
  ...ok(
    `POST ${P}/auth/logout`,
    `POST ${P}/auth/password`,
    `POST ${P}/auth/acting`,
    `DELETE ${P}/auth/sessions/:id`,
    `PUT ${P}/settings/:key`,
    `PUT ${P}/settings/sla-policies`,
    `PUT ${P}/machines/:id/criticality`,
    `PUT ${P}/lists/:list/:code`,
    `DELETE ${P}/lists/:list/:id`,
    `PUT ${P}/translations/:id`,
    `POST ${P}/push/subscribe`,
    `POST ${P}/push/unsubscribe`,
  ),
  [`GET ${P}/config`]: z.union([configReplySchema, configSameSchema]),
  [`GET ${P}/settings`]: z.array(settingRowSchema),
  [`GET ${P}/lists/:list`]: z.array(listRowSchema),
  [`GET ${P}/translations/missing`]: z.array(missingTranslationSchema),
  [`GET ${P}/push/key`]: pushKeyReplySchema,
  [`POST ${P}/push/test`]: pushSentReplySchema,
  ...PEOPLE_REPLIES,
  ...SUPPORT_ACCESS_REPLIES,
  ...AUDIT_REPLIES,
  ...settingsResource('machines', machineReplySchema),
  ...settingsResource('segments', segmentReplySchema),
  ...settingsResource('groups', groupReplySchema),
  ...settingsResource('shifts', shiftReplySchema),
  ...LIST_NAMES.reduce(
    (all, list) => ({ ...all, ...settingsResource(`settings/lists/${list}`, listItemReplySchema) }),
    {},
  ),
  ...settingsResource('settings/glossary', glossaryReplySchema),
  ...settingsResource('roster', rosterReplySchema),
  [`POST ${P}/roster/copy`]: rosterCopyReplySchema,
  ...settingsResource('escalation-rules', ruleReplySchema),
  [`GET ${P}/analytics-profile`]: profilePageSchema,
  [`PUT ${P}/analytics-profile/:id`]: profileReplySchema,
  [`GET ${P}/analytics/figures`]: figuresReplySchema,
  [`POST ${P}/analytics/run`]: figuresReplySchema,
  [`GET ${P}/analytics/drill`]: drillReplySchema,
  [`GET ${P}/machines/:id/moves`]: z.array(machineMoveReplySchema),
  ...commands,
  [`POST ${P}/tickets/past`]: commandReplySchema,
  [`GET ${P}/tickets`]: ticketPageSchema,
  [`GET ${P}/state`]: stateReplySchema,
  [`GET ${P}/board/today`]: boardTodayReplySchema,
  [`GET ${P}/board/signoff`]: signoffFeedReplySchema,
  [`GET ${P}/tickets/:id/signoff-qr`]: null,
  [`GET ${P}/tickets/:id`]: ticketDetailSchema,
  [`GET ${P}/tickets/:id/pdf`]: null,
  [`GET ${P}/reports/day.pdf`]: null,
  [`GET ${P}/files/:id`]: null,
  [`GET ${P}/brand/logo`]: null,
  [`PUT ${P}/company/logo`]: logoReplySchema,
};
