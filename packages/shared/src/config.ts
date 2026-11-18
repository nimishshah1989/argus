import { z } from 'zod';
import { en } from './i18n/index.js';

export const LIST_NAMES = [
  'wait_reason',
  'work_type',
  'quick_problem',
  'breakdown_category',
  'maint_code',
  'failure_code',
  'observed_by',
  'location',
  'cell',
  'task_reason',
  'lockout_step',
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

export const featuresSchema = z.record(z.boolean());

/**
 * The plant's Gujarati overrides (D17: one `setting`, D7: laid over the bundled catalogue). A key must be a real
 * catalogue key, so a typo cannot sit in the setting forever; a value is real Gujarati, never blank.
 */
export const i18nOverridesSchema = z
  .record(z.string().min(1).max(200), z.string().trim().min(1).max(500))
  .refine((overrides) => Object.keys(overrides).every((key) => Object.hasOwn(en, key)), {
    message: 'Unknown message key',
  });
export type I18nOverrides = Record<string, string>;

export const settingsPutSchema = z.object({ value: z.unknown() });
export type SettingsPutBody = z.infer<typeof settingsPutSchema>;

export const machineCriticalitySchema = z
  .object({ criticality: criticalitySchema.nullable() })
  .strict();
export type MachineCriticalityBody = z.infer<typeof machineCriticalitySchema>;

export const translationSchema = z.object({
  labelGu: z.string().max(200).optional(),
  labelHi: z.string().max(200).optional(),
});
export type TranslationBody = z.infer<typeof translationSchema>;

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}

const str = z.string();
const nstr = z.string().nullable();

export const listItemSchema = z
  .object({
    id: str,
    list: str,
    code: str,
    label: str,
    labelGu: nstr,
    labelHi: nstr,
    sort: z.number(),
    active: z.boolean(),
    isVendor: z.boolean(),
    pausesSla: z.boolean(),
    tag: nstr,
  })
  .strict();
export type ListItem = z.infer<typeof listItemSchema>;

export const segmentSchema = z
  .object({
    id: str,
    code: str,
    name: str,
    sort: z.number(),
    show_on_board: z.boolean(),
    group_by: str,
  })
  .strict();
export type Segment = z.infer<typeof segmentSchema>;

export const groupSchema = z
  .object({
    id: str,
    segment_id: str,
    code: str,
    name: str,
    sort: z.number(),
    hidden: z.boolean(),
  })
  .strict();
export type Group = z.infer<typeof groupSchema>;

export const machineSchema = z
  .object({
    id: str,
    code: str,
    category: nstr,
    cell: nstr,
    segment_id: nstr,
    group_id: nstr,
    criticality: criticalitySchema.nullable(),
  })
  .strict();
export type Machine = z.infer<typeof machineSchema>;

export const personSchema = z
  .object({
    id: str,
    name: str,
    team: str,
    title: nstr,
    active: z.boolean(),
    phone: nstr.optional(),
  })
  .strict();
export type Person = z.infer<typeof personSchema>;

export const shiftSchema = z
  .object({
    id: str,
    code: str,
    name: str,
    starts_at: str,
    ends_at: str,
    crosses_midnight: z.boolean(),
  })
  .strict();
export type Shift = z.infer<typeof shiftSchema>;

const severityPairSchema = z.object({ stopped: severitySchema, support: severitySchema }).strict();
export const severityMatrixReplySchema = z
  .object({
    default: z
      .object({ A: severityPairSchema, B: severityPairSchema, C: severityPairSchema })
      .strict(),
    workRequest: severitySchema,
    urgentWorkRequest: severitySchema,
  })
  .strict();

export const plantConfigSchema = z
  .object({
    features: featuresSchema,
    language: str,
    timeZone: str,
    lists: z.record(z.array(listItemSchema)),
    segments: z.array(segmentSchema),
    groups: z.array(groupSchema),
    machines: z.array(machineSchema),
    people: z.array(personSchema),
    shifts: z.array(shiftSchema),
    severityMatrix: severityMatrixReplySchema,
    i18nOverrides: i18nOverridesSchema,
  })
  .strict();

export const settingRowSchema = z.object({ key: str, value: z.unknown() }).strict();

export const listRowSchema = z
  .object({
    id: str,
    code: str,
    label: str,
    label_gu: nstr,
    label_hi: nstr,
    sort: z.number(),
    active: z.boolean(),
    is_vendor: z.boolean(),
    pauses_sla: z.boolean(),
    tag: nstr,
  })
  .strict();

export const missingTranslationSchema = z
  .object({ id: str, list: str, code: str, label: str, label_gu: nstr, label_hi: nstr })
  .strict();
