import { z } from 'zod';
import { taskDownMinSchema, taskInputSchema } from './tasks.js';

// ISO timestamps are coerced to Date so the parsed body matches the domain Command types.
const iso = z.coerce.date();

/** The shared cap on every reason a ticket command carries; the phone field must not type past it. */
export const REASON_MAX_LENGTH = 500;

export const raiseTicketSchema = z
  .object({
    kind: z.enum(['stopped', 'support', 'general']).default('stopped'),
    machineId: z.string().uuid().optional(),
    location: z.string().max(200).optional(),
    workType: z.string().max(60).optional(),
    urgent: z.boolean().optional(),
    problem: z.string().min(1).max(2000),
    problemLang: z.string().max(2000).optional(),
    reportedByPersonId: z.string().uuid().optional(),
    reportedByRole: z.string().max(60).optional(),
    startNow: z.boolean().optional(),
    startByPersonId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'general') {
      if (!value.location) {
        ctx.addIssue({ code: 'custom', path: ['location'], message: 'Location is required' });
      }
      if (!value.workType) {
        ctx.addIssue({ code: 'custom', path: ['workType'], message: 'Work type is required' });
      }
    } else if (!value.machineId) {
      ctx.addIssue({ code: 'custom', path: ['machineId'], message: 'Machine is required' });
    }
  });
export type RaiseTicketBody = z.infer<typeof raiseTicketSchema>;

export const COMMAND_ACTIONS = [
  'start',
  'join',
  'leave',
  'pause',
  'resume',
  'transfer',
  'update',
  'machine-running',
  'machine-stopped',
  'close',
  'report',
  'cancel',
  'restore',
  'correct',
  'upgrade-kind',
  'acknowledge',
  'acknowledge-escalation',
  'handback',
  'lockout-confirm',
] as const;
export type CommandAction = (typeof COMMAND_ACTIONS)[number];

/**
 * Who acts is the session's person, so a command may leave this out. Repeating that person is accepted (older
 * clients do); naming anyone else is refused with 403 `forbidden`, on a shared phone too.
 */
const actingPerson = z.string().uuid().optional();

export const startTicketSchema = z.object({
  personId: actingPerson,
  at: iso.optional(),
});
export type StartTicketBody = z.infer<typeof startTicketSchema>;

export const acknowledgeTicketSchema = z.object({ personId: actingPerson });
export type AcknowledgeTicketBody = z.infer<typeof acknowledgeTicketSchema>;

/** Who acknowledges an escalation is the signed-in person; the body may leave it out or repeat it (checked against the session). */
export const acknowledgeEscalationSchema = z.object({ personId: actingPerson });

export const joinTicketSchema = z.object({
  personId: actingPerson,
  role: z.enum(['primary', 'support']),
});
export type JoinTicketBody = z.infer<typeof joinTicketSchema>;

export const leaveTicketSchema = z.object({
  personId: actingPerson,
  reason: z.string().min(1).max(REASON_MAX_LENGTH),
});
export type LeaveTicketBody = z.infer<typeof leaveTicketSchema>;

export const pauseTicketSchema = z.object({
  personId: actingPerson,
  reasonCode: z.string().min(1).max(60),
  note: z.string().max(2000).optional(),
  expectedBackOn: z.string().optional(),
  assignToPersonId: z.string().uuid().optional(),
});
export type PauseTicketBody = z.infer<typeof pauseTicketSchema>;

export const resumeTicketSchema = z.object({
  personId: actingPerson,
  note: z.string().max(2000).optional(),
});
export type ResumeTicketBody = z.infer<typeof resumeTicketSchema>;

export const transferTicketSchema = z.object({
  personId: actingPerson,
  toPersonId: z.string().uuid().optional(),
  toShift: z.string().max(60).optional(),
  note: z.string().min(1).max(2000),
});
export type TransferTicketBody = z.infer<typeof transferTicketSchema>;

export const updateTicketSchema = z.object({
  personId: actingPerson,
  text: z.string().min(1).max(2000),
  spare: z.string().max(200).optional(),
  expectedOn: z.string().optional(),
});
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;

export const machineRunningSchema = z.object({
  personId: actingPerson,
  at: iso.optional(),
});
export type MachineRunningBody = z.infer<typeof machineRunningSchema>;

export const machineStoppedSchema = z.object({
  personId: actingPerson,
  at: iso.optional(),
});
export type MachineStoppedBody = z.infer<typeof machineStoppedSchema>;

export const breakdownReportSchema = z.object({
  problem: z.string().min(1).max(2000).optional(),
  observedBy: z.string().max(200).optional(),
  correctiveAction: z.string().max(4000).optional(),
  doneByPersonIds: z.array(z.string().uuid()).optional(),
  supportedByPersonIds: z.array(z.string().uuid()).optional(),
  downtimeMin: z.number().int().min(0).optional(),
  responseMin: z.number().int().min(0).optional(),
  repairMin: z.number().int().min(0).optional(),
  breakdownCategory: z.enum(['E', 'M', 'E/M', 'PM']).optional(),
  maintCode: z.string().max(60).optional(),
  spareUsed: z.string().max(200).optional(),
  rootCause: z.string().max(2000).optional(),
  /** The person the report is handed over to. Typed text (`handoverName`) is for imported history; use this. */
  handoverPersonId: z.string().uuid().optional(),
  handoverName: z.string().max(120).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  shiftCode: z.string().max(60).optional(),
});
export type BreakdownReportBody = z.infer<typeof breakdownReportSchema>;

const isoInstant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

/** A breakdown that already happened: recorded after the fact as a closed ticket with its report. */
export const pastBreakdownSchema = z
  .object({
    machineId: z.string().uuid(),
    reportedAt: isoInstant,
    workStartedAt: isoInstant.optional(),
    runningAt: isoInstant,
    problem: z.string().min(1).max(2000),
    reportedByPersonId: z.string().uuid().optional(),
    closedByPersonId: z.string().uuid().optional(),
    report: breakdownReportSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const { reportedAt, workStartedAt, runningAt } = value;
    if (workStartedAt && workStartedAt < reportedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['workStartedAt'],
        message: 'Work cannot start before the stop was reported',
      });
    }
    if (runningAt < (workStartedAt ?? reportedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['runningAt'],
        message: 'The machine cannot run again before work began',
      });
    }
  });
export type PastBreakdownBody = z.infer<typeof pastBreakdownSchema>;

export const closeTicketSchema = z.object({
  personId: actingPerson,
  kind: z.enum(['report', 'no_report', 'done']),
  at: iso.optional(),
  note: z.string().max(2000).optional(),
  report: breakdownReportSchema.optional(),
  /** A job left unfinished: becomes a child task of this ticket (not allowed on a plain work request). */
  task: taskInputSchema.optional(),
  /** Closing a follow-up task only: the minutes the machine stood still for it. */
  taskDownMin: taskDownMinSchema.optional(),
});
export type CloseTicketBody = z.infer<typeof closeTicketSchema>;

export const reportTicketSchema = z.object({
  personId: actingPerson,
  report: breakdownReportSchema,
});
export type ReportTicketBody = z.infer<typeof reportTicketSchema>;

export const cancelTicketSchema = z.object({
  personId: actingPerson,
  reason: z.string().min(1).max(REASON_MAX_LENGTH),
});
export type CancelTicketBody = z.infer<typeof cancelTicketSchema>;

/** Production's answer to a sign-off; a dispute needs its reason. */
export const handbackTicketSchema = z
  .object({
    personId: actingPerson,
    response: z.enum(['confirmed', 'disputed']),
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH).optional(),
  })
  .refine((body) => body.response === 'confirmed' || body.reason !== undefined, {
    message: 'A reason is required',
    path: ['reason'],
  });
export type HandbackTicketBody = z.infer<typeof handbackTicketSchema>;

export const restoreTicketSchema = z.object({
  personId: actingPerson,
  reason: z.string().min(1).max(REASON_MAX_LENGTH),
});
export type RestoreTicketBody = z.infer<typeof restoreTicketSchema>;

export const correctTicketSchema = z.object({
  reason: z.string().min(1).max(REASON_MAX_LENGTH),
  changes: z.object({
    reportedAt: iso.optional(),
    startedAt: iso.optional(),
    closedAt: iso.optional(),
    problem: z.string().min(1).max(2000).optional(),
    machineId: z.string().uuid().nullable().optional(),
    kind: z.enum(['stopped', 'support', 'general']).optional(),
    leadPersonId: z.string().uuid().nullable().optional(),
    closedByPersonId: z.string().uuid().nullable().optional(),
    // set directly, as the admin's correction of his app did; kept as overrides and marked in the figures
    // null takes the minutes set by hand off again
    activeMin: z.number().int().min(0).max(100000).nullable().optional(),
    waitMin: z.number().int().min(0).max(100000).nullable().optional(),
  }),
});
export type CorrectTicketBody = z.infer<typeof correctTicketSchema>;

// The domain exposes upgradeKind; the acting person is the session's person, not the body.
export const upgradeKindSchema = z.object({ personId: actingPerson });
export type UpgradeKindBody = z.infer<typeof upgradeKindSchema>;

const TICKET_STATUSES: readonly string[] = ['open', 'working', 'waiting', 'closed', 'cancelled'];
const TICKET_KINDS: readonly string[] = ['stopped', 'support', 'general'];

function csvOk(raw: string | undefined, allowed: readonly string[]): boolean {
  if (raw === undefined) return true;
  const parts = raw.split(',').filter(Boolean);
  return parts.length > 0 && parts.every((part) => allowed.includes(part));
}

export const listTicketsQuerySchema = z
  .object({
    status: z.string().optional(),
    kind: z.string().optional(),
    machineId: z.string().uuid().optional(),
    personId: z.string().uuid().optional(),
    raisedBy: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .superRefine((value, ctx) => {
    if (!csvOk(value.status, TICKET_STATUSES)) {
      ctx.addIssue({ code: 'custom', message: 'Unknown status', path: ['status'] });
    }
    if (!csvOk(value.kind, TICKET_KINDS)) {
      ctx.addIssue({ code: 'custom', message: 'Unknown kind', path: ['kind'] });
    }
  });
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
