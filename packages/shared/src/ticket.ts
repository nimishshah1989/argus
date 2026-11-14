import { z } from 'zod';

// ISO timestamps are coerced to Date so the parsed body matches the domain Command types.
const iso = z.coerce.date();

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
] as const;
export type CommandAction = (typeof COMMAND_ACTIONS)[number];

export const startTicketSchema = z.object({
  personId: z.string().uuid(),
  at: iso.optional(),
});
export type StartTicketBody = z.infer<typeof startTicketSchema>;

export const joinTicketSchema = z.object({
  personId: z.string().uuid(),
  role: z.enum(['primary', 'support']),
});
export type JoinTicketBody = z.infer<typeof joinTicketSchema>;

export const leaveTicketSchema = z.object({
  personId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});
export type LeaveTicketBody = z.infer<typeof leaveTicketSchema>;

export const pauseTicketSchema = z.object({
  personId: z.string().uuid(),
  reasonCode: z.string().min(1).max(60),
  note: z.string().max(2000).optional(),
  expectedBackOn: z.string().optional(),
  assignToPersonId: z.string().uuid().optional(),
});
export type PauseTicketBody = z.infer<typeof pauseTicketSchema>;

export const resumeTicketSchema = z.object({
  personId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});
export type ResumeTicketBody = z.infer<typeof resumeTicketSchema>;

export const transferTicketSchema = z.object({
  personId: z.string().uuid(),
  toPersonId: z.string().uuid().optional(),
  toShift: z.string().max(60).optional(),
  note: z.string().min(1).max(2000),
});
export type TransferTicketBody = z.infer<typeof transferTicketSchema>;

export const updateTicketSchema = z.object({
  personId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  spare: z.string().max(200).optional(),
  expectedOn: z.string().optional(),
});
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;

export const machineRunningSchema = z.object({
  personId: z.string().uuid(),
  at: iso.optional(),
});
export type MachineRunningBody = z.infer<typeof machineRunningSchema>;

export const machineStoppedSchema = z.object({
  personId: z.string().uuid(),
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
  handoverName: z.string().max(120).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  shiftCode: z.string().max(60).optional(),
});
export type BreakdownReportBody = z.infer<typeof breakdownReportSchema>;

export const closeTicketSchema = z.object({
  personId: z.string().uuid(),
  kind: z.enum(['report', 'no_report', 'done']),
  at: iso.optional(),
  note: z.string().max(2000).optional(),
  report: breakdownReportSchema.optional(),
});
export type CloseTicketBody = z.infer<typeof closeTicketSchema>;

export const reportTicketSchema = z.object({
  personId: z.string().uuid(),
  report: breakdownReportSchema,
});
export type ReportTicketBody = z.infer<typeof reportTicketSchema>;

export const cancelTicketSchema = z.object({
  personId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});
export type CancelTicketBody = z.infer<typeof cancelTicketSchema>;

export const restoreTicketSchema = z.object({
  personId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});
export type RestoreTicketBody = z.infer<typeof restoreTicketSchema>;

export const correctTicketSchema = z.object({
  reason: z.string().min(1).max(500),
  changes: z.object({
    reportedAt: iso.optional(),
    startedAt: iso.optional(),
    closedAt: iso.optional(),
    problem: z.string().min(1).max(2000).optional(),
    machineId: z.string().uuid().nullable().optional(),
    kind: z.enum(['stopped', 'support', 'general']).optional(),
    leadPersonId: z.string().uuid().nullable().optional(),
    closedByPersonId: z.string().uuid().nullable().optional(),
  }),
});
export type CorrectTicketBody = z.infer<typeof correctTicketSchema>;

// The domain exposes upgradeKind; the acting person is the session's person, not the body.
export const upgradeKindSchema = z.object({
  personId: z.string().uuid().optional(),
});
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
