import { z } from 'zod';
import { severitySchema } from './config.js';

export const slaPolicySchema = z.object({
  id: z.string().uuid(),
  severity: severitySchema,
  ackMinutes: z.number().int().positive(),
  restoreMinutes: z.number().int().positive(),
  businessHoursOnly: z.boolean(),
});
export type SlaPolicy = z.infer<typeof slaPolicySchema>;

export const slaTimerStateSchema = z.enum(['running', 'paused', 'stopped']);
export type SlaTimerState = z.infer<typeof slaTimerStateSchema>;

export const slaTimerSchema = z
  .object({
    id: z.string().min(1),
    state: slaTimerStateSchema,
    breached: z.boolean(),
    dueAt: z.string().datetime({ offset: true }).nullable(),
    pausedAt: z.string().datetime({ offset: true }).nullable(),
    stoppedAt: z.string().datetime({ offset: true }).nullable(),
    remainingMinutes: z.number().int(),
  })
  .strict();
export type SlaTimer = z.infer<typeof slaTimerSchema>;

export const slaProjectionSchema = z
  .object({
    ack: slaTimerSchema.nullable(),
    restore: slaTimerSchema.nullable(),
  })
  .strict();
export type SlaProjection = z.infer<typeof slaProjectionSchema>;

const policyInputSchema = slaPolicySchema.omit({ id: true });

export const slaPoliciesUpdateSchema = z
  .object({ policies: z.array(policyInputSchema).length(4) })
  .refine(
    (body) => new Set(body.policies.map((policy) => policy.severity)).size === 4,
    'Each severity must appear exactly once',
  );
export type SlaPoliciesUpdate = z.infer<typeof slaPoliciesUpdateSchema>;
