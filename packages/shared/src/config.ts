import { z } from 'zod';

export const LIST_NAMES = [
  'wait_reason',
  'work_type',
  'quick_problem',
  'breakdown_category',
  'maint_code',
  'observed_by',
  'location',
  'cell',
  'task_reason',
] as const;
export type ListName = (typeof LIST_NAMES)[number];

export const severitySchema = z.enum(['S1', 'S2', 'S3', 'S4']);
export type Severity = z.infer<typeof severitySchema>;

export const criticalitySchema = z.enum(['A', 'B', 'C']);
export type Criticality = z.infer<typeof criticalitySchema>;

export const severityMatrixSchema = z.object({
  default: z.object({
    A: z.object({
      stopped: severitySchema,
      support: severitySchema,
    }),
    B: z.object({
      stopped: severitySchema,
      support: severitySchema,
    }),
    C: z.object({
      stopped: severitySchema,
      support: severitySchema,
    }),
  }),
  workRequest: severitySchema,
  urgentWorkRequest: severitySchema,
});
export type SeverityMatrix = z.infer<typeof severityMatrixSchema>;

export const listUpsertSchema = z.object({
  label: z.string().min(1).max(200),
  labelGu: z.string().max(200).optional(),
  labelHi: z.string().max(200).optional(),
  sort: z.number().int().optional(),
  active: z.boolean().optional(),
  isVendor: z.boolean().optional(),
  pausesSla: z.boolean().optional(),
  tag: z.string().max(40).optional(),
});
export type ListUpsertBody = z.infer<typeof listUpsertSchema>;

export const settingsPutSchema = z.object({ value: z.unknown() });
export type SettingsPutBody = z.infer<typeof settingsPutSchema>;

export const translationSchema = z.object({
  labelGu: z.string().max(200).optional(),
  labelHi: z.string().max(200).optional(),
});
export type TranslationBody = z.infer<typeof translationSchema>;

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}
