import { z } from 'zod';
import { criticalitySchema, severitySchema } from './config.js';
import { taskEventSchema } from './tasks.js';

export const isoDateTimeSchema = z.string().datetime({ offset: true });
const iso = isoDateTimeSchema.nullable();
const str = z.string().nullable();
const num = z.number().nullable();

export const ticketKindSchema = z.enum(['stopped', 'support', 'general']);
export type TicketKind = z.infer<typeof ticketKindSchema>;
export const ticketStatusSchema = z.enum(['open', 'working', 'waiting', 'closed', 'cancelled']);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export const closeKindSchema = z.enum(['report', 'no_report', 'done']);
export type CloseKind = z.infer<typeof closeKindSchema>;

export const figuresSchema = z
  .object({
    responseMin: num,
    activeMin: z.number(),
    waitMin: z.number(),
    vendorMin: z.number(),
    handoverWaitMin: z.number(),
    downAccMin: z.number(),
    downtimeMin: num,
    followMin: num,
    repairMin: z.number(),
    perPerson: z.record(z.number()),
    overridden: z
      .array(z.enum(['responseMin', 'activeMin', 'waitMin', 'downtimeMin', 'repairMin']))
      .optional(),
  })
  .strict();
export type Figures = z.infer<typeof figuresSchema>;

/** The 46 keys `ticketProjection` emits; accountability's `sla` part is added in replies.ts. */
export const ticketSchema = z
  .object({
    id: z.string(),
    ref: z.string(),
    problem: z.string(),
    kind: ticketKindSchema,
    status: ticketStatusSchema,
    machineId: str,
    reportedByPersonId: str,
    leadPersonId: str,
    transferToPersonId: str,
    transferToShift: str,
    waitReason: str,
    assignedToPersonId: str,
    closedByPersonId: str,
    closeNote: str,
    taskReason: str,
    taskExpectedOn: str,
    location: str,
    workType: str,
    problemLang: str,
    reportedByRole: str,
    parentId: str,
    waitingSpare: str,
    raisedLoginId: str,
    reportedAt: isoDateTimeSchema,
    startedAt: iso,
    segmentStartedAt: iso,
    handoverSince: iso,
    waitSince: iso,
    machineRunningAt: iso,
    machineStoppedAt: iso,
    closedAt: iso,
    kindUpgradedAt: iso,
    expectedBackAt: iso,
    cancelledAt: isoDateTimeSchema.optional(),
    selfStarted: z.boolean(),
    handedOver: z.boolean(),
    urgent: z.boolean(),
    transfers: z.number(),
    lastEventSeq: z.number(),
    taskDownMin: num,
    closeKind: closeKindSchema.nullable(),
    figures: figuresSchema.nullable(),
    severity: severitySchema.nullable(),
    criticalitySnapshot: criticalitySchema.nullable(),
    raisedChannel: z.string(),
    machineSnapshot: z
      .object({
        code: str.optional(),
        category: str.optional(),
        cell: str.optional(),
        criticality: criticalitySchema.nullable().optional(),
        id: str.optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

/** One step of an escalation, as the history shows it: which rule, at what level, who was told, the attempt. */
export const escalationStepSchema = z
  .object({
    ruleId: z.string(),
    trigger: z.string(),
    /** Names one run of a rule on this ticket (a breach, a stretch of downtime): repeats share it. */
    episode: z.number(),
    level: z.string(),
    attempt: z.number(),
    /** The channel the rule asks for. */
    channel: z.string(),
    /** Set when that channel has no sender yet (WhatsApp) and the step went out on this one instead. */
    channelFallback: z.string().optional(),
    /** How many people the step told. */
    toldCount: z.number(),
    /** Nobody was on the ladder for the rule: the plant's heads and admins were told instead. */
    noLadder: z.boolean().optional(),
    /** Read from the notifications; `null` once they are purged (90 days) though the step told people. */
    toldPersonIds: z.array(z.string()).nullable(),
  })
  .strict();
export type EscalationStep = z.infer<typeof escalationStepSchema>;

export const ticketEventSchema = z
  .object({
    seq: z.number(),
    type: z.string(),
    at: isoDateTimeSchema,
    text: str,
    reason: str,
    actingPersonId: str,
    loginId: str,
    isVendor: z.boolean(),
    /** A correction's old and new values, field by field; null on every other event. */
    changes: z
      .array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() }))
      .nullable(),
    /** Set on an `escalate` event, null on every other; optional so a client that builds a reply by hand may leave it out. */
    escalation: escalationStepSchema.nullable().optional(),
    /** On an `escalation_ack`: the highest level the acknowledgement covered, as its payload records it. */
    escalationLevel: z.string().nullable().optional(),
    /** Set on a `task` event (a follow-up task left, or done); null on every other. */
    task: taskEventSchema.nullable().optional(),
  })
  .strict();
export type TicketEvent = z.infer<typeof ticketEventSchema>;

export const ticketPersonSchema = z
  .object({ personId: z.string(), role: z.string(), leftAt: iso, leftReason: str })
  .strict();
export type TicketPerson = z.infer<typeof ticketPersonSchema>;

/** The ticket's escalation state: the levels still waiting for someone, and the newest step that was told. */
export const escalationStateSchema = z
  .object({
    /** A chain has told someone and no acknowledge at its level or above covers it yet. */
    pendingLevels: z.array(z.string()),
    /** The newest `escalate` event's level, null when the ticket never escalated. */
    lastLevel: z.string().nullable(),
    lastAt: isoDateTimeSchema.nullable(),
  })
  .strict();
export type EscalationState = z.infer<typeof escalationStateSchema>;

export const ticketIntervalSchema = z
  .object({ personId: z.string(), role: z.string(), startedAt: isoDateTimeSchema, endedAt: iso })
  .strict();
export type TicketInterval = z.infer<typeof ticketIntervalSchema>;

/** The stored report as detail replies carry it (`BreakdownReport` on the web). */
export const storedReportSchema = z
  .object({
    id: z.string(),
    machineId: z.string(),
    date: z.string(),
    shiftCode: z.string(),
    problem: z.string(),
    ticketId: str,
    observedBy: str,
    correctiveAction: str,
    breakdownCategory: str,
    maintCode: str,
    spareUsed: str,
    rootCause: str,
    handoverPersonId: str,
    handoverName: str,
    submittedByPersonId: str,
    downtimeMin: z.number(),
    responseMin: num,
    repairMin: num,
    submittedAt: isoDateTimeSchema,
    people: z.array(
      z.object({ personId: z.string(), role: z.enum(['done', 'supported']) }).strict(),
    ),
  })
  .strict();
export type BreakdownReport = z.infer<typeof storedReportSchema>;
