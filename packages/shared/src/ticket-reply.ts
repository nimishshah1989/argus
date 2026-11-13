import { z } from 'zod';
import { criticalitySchema, severitySchema } from './config.js';

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

/** The 47 keys `ticketProjection` emits; accountability's `sla` part is added in replies.ts. */
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
    slaPolicyId: str,
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
  })
  .strict();
export type TicketEvent = z.infer<typeof ticketEventSchema>;

export const ticketPersonSchema = z
  .object({ personId: z.string(), role: z.string(), leftAt: iso, leftReason: str })
  .strict();
export type TicketPerson = z.infer<typeof ticketPersonSchema>;

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
