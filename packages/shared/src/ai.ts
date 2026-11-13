import { z } from 'zod';

export const AI_FEATURES = ['diagnosis'] as const;
export type AiFeatureName = (typeof AI_FEATURES)[number];
export const AI_SUBJECT_TYPES = ['ticket'] as const;

export const aiSuggestPayloadSchema = z
  .object({
    v: z.literal(1),
    tenantId: z.string().uuid(),
    feature: z.enum(AI_FEATURES),
    subjectType: z.enum(AI_SUBJECT_TYPES),
    subjectId: z.string().uuid(),
    promptVersion: z.string().min(1).max(40),
  })
  .strict();
export type AiSuggestPayload = z.infer<typeof aiSuggestPayloadSchema>;

export const aiConsentSchema = z.object({
  status: z.enum(['granted', 'withdrawn']),
  signedOn: z.string().date(),
  fileId: z.string().uuid(),
  wordingVersion: z.string().min(1).max(40),
  recordedByLoginId: z.string().uuid(),
}); // setting key 'ai.consent'
export const aiMonthlyCapUsdSchema = z.number().positive(); // setting key 'ai.monthlyCapUsd'

export const AI_OUTCOMES = [
  'ok',
  'feature_off',
  'no_provider',
  'no_consent',
  'cap_reached',
  'stale',
  'redaction_failed',
  'provider_error',
  'rate_limited',
  'overloaded',
  'provider_rejected',
  'schema_invalid',
  'duplicate',
] as const;
export type AiOutcome = (typeof AI_OUTCOMES)[number];
/** Outcomes that can be stored on a row: the others never create or change one. */
export const AI_ROW_OUTCOMES = [
  'ok',
  'redaction_failed',
  'provider_error',
  'rate_limited',
  'overloaded',
  'provider_rejected',
  'schema_invalid',
] as const;
export type AiRowOutcome = (typeof AI_ROW_OUTCOMES)[number];
export const AI_SUGGESTION_STATUSES = ['running', 'retry_wait', 'ready', 'failed'] as const;
