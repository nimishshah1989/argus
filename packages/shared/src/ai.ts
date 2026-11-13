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

export const diagnosisCoverageSchema = z
  .object({
    thisMachine: z.number().int().min(0), // past tickets sent for this machine
    withNotes: z.number().int().min(0), // of those, with a closing note of 3+ words
    sameModel: z.number().int().min(0), // past tickets sent from same-model machines
    sameModelMachines: z.number().int().min(0), // distinct machines among them
    templatesLeftOut: z.number().int().min(0), // rows left out as template notes
  })
  .strict();
export const diagnosisCandidateV1Schema = z
  .object({
    cause: z.string(),
    firstCheck: z.string(),
    expectedFix: z.string(),
    evidenceTicketIds: z.array(z.string().uuid()).max(8),
    isGuess: z.boolean(),
  })
  .strict();
/** Stored in `ai_suggestion.output` for feature 'diagnosis' (D22). Every number in it is set by code. */
export const diagnosisOutputV1Schema = z
  .object({
    v: z.literal(1),
    safetyFlagged: z.boolean(),
    safetyReason: z.string(),
    safetyWords: z.array(z.string()),
    candidates: z.array(diagnosisCandidateV1Schema).max(3),
    coverage: diagnosisCoverageSchema,
  })
  .strict();
export type DiagnosisCoverage = z.infer<typeof diagnosisCoverageSchema>;
export type DiagnosisOutputV1 = z.infer<typeof diagnosisOutputV1Schema>;
