import { z } from 'zod';
import type { DiagnosisCoverage, DiagnosisOutputV1 } from '@uptimo/shared';
import type { HistoryRow } from '../tickets/index.js';

const candidate = z
  .object({
    cause: z.string().min(1).max(600),
    evidence: z.array(z.string().max(20)).max(8),
    firstCheck: z.string().min(1).max(600),
    expectedFix: z.string().min(1).max(600),
  })
  .strict();
/** The answer the model gives (D22 §10). */
export const diagnosisAnswerSchema = z
  .object({
    safetyFlagged: z.boolean(),
    safetyReason: z.string().max(600),
    candidates: z.array(candidate).max(3),
  })
  .strict()
  .refine((a) => !a.safetyFlagged || a.safetyReason.trim().length > 0, { path: ['safetyReason'] });
export type DiagnosisAnswer = z.infer<typeof diagnosisAnswerSchema>;

const text = { type: 'string' };
/** Strict structured-output schema. Limits stay in zod. Safety comes first so it is written before the causes. */
export const DIAGNOSIS_ANSWER_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['safetyFlagged', 'safetyReason', 'candidates'],
  properties: {
    safetyFlagged: { type: 'boolean' },
    safetyReason: text,
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cause', 'evidence', 'firstCheck', 'expectedFix'],
        properties: {
          cause: text,
          evidence: { type: 'array', items: text },
          firstCheck: text,
          expectedFix: text,
        },
      },
    },
  },
};

/** `type`, not `interface`, so it is assignable to AiJson. Blank fields are omitted. */
export type HistoryItem = {
  key: string;
  date: string;
  machine?: string;
  problem: string;
  closeNote?: string;
  action?: string;
  rootCause?: string;
  spare?: string;
  code?: string;
  category?: string;
};
export interface EvidenceInput {
  problem: string;
  own: readonly HistoryRow[]; // this machine, newest first
  siblings: readonly HistoryRow[]; // same-model machines, newest first
  siblingCodes: ReadonlyMap<string, string>; // machine id -> code
  seenElsewhere: ReadonlySet<string>; // from tickets.notesSeenElsewhere
}
export interface Evidence {
  thisMachine: HistoryItem[];
  sameModel: HistoryItem[];
  keys: Record<string, string>; // 'T1' -> ticket id
  coverage: DiagnosisCoverage;
  safetyWords: string[];
}

export function normaliseNote(value: string | null): string | null {
  const t = value?.trim().replace(/\s+/g, ' ').toLowerCase();
  return t ? t : null;
}

export function closingNote(row: HistoryRow): string | null {
  return row.action?.trim() || row.closeNote?.trim() || null;
}

const SAFETY: readonly (readonly [string, RegExp])[] = [
  ['bypass', /\bby-?pass/i],
  ['jumper', /\bjumper/i],
  ['temporary fix', /\btemporary\b|\btemp (?:fix|solution)\b/i],
  ['jugaad', /\bjugaa?d/i],
  ['short circuit', /\bshort[- ]?circuit|\bshorted\b/i],
  ['spark', /\bspark/i],
  ['smoke', /\bsmok/i],
  ['burn', /\bburn/i],
  ['shock', /\bshock/i],
  ['interlock', /\binterlock/i],
  ['guard', /\bguard/i],
];

export function safetyWords(texts: readonly string[]): string[] {
  return SAFETY.filter(([, re]) => texts.some((t) => re.test(t))).map(([word]) => word);
}

/** One outage, one row: same machine, UTC day, problem and closing note keep only the first. */
function dedupe(rows: readonly HistoryRow[]): HistoryRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = JSON.stringify([
      r.machineId,
      r.reportedAt.toISOString().slice(0, 10),
      normaliseNote(r.problem),
      normaliseNote(closingNote(r)),
    ]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const clip = (v: string | null): string | undefined => v?.trim().slice(0, 500) || undefined;
const isText = (v: string | null): v is string => v !== null;

export function buildEvidence(input: EvidenceInput): Evidence {
  const keys: Record<string, string> = {};
  let templatesLeftOut = 0;
  const keep = (rows: readonly HistoryRow[]): HistoryRow[] =>
    dedupe(rows).filter((r) => {
      const n = normaliseNote(closingNote(r));
      const stock = n !== null && input.seenElsewhere.has(n);
      if (stock) templatesLeftOut += 1;
      return !stock;
    });
  const item = (r: HistoryRow, sibling: boolean): HistoryItem => {
    const key = `T${Object.keys(keys).length + 1}`;
    keys[key] = r.id;
    const optional = {
      machine: sibling ? input.siblingCodes.get(r.machineId) : undefined,
      closeNote: clip(r.closeNote),
      action: clip(r.action),
      rootCause: clip(r.rootCause),
      spare: clip(r.spare),
      code: clip(r.code),
      category: clip(r.category),
    };
    return {
      key,
      date: r.reportedAt.toISOString().slice(0, 10),
      problem: clip(r.problem) ?? '',
      ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined)),
    };
  };
  const ownRows = keep(input.own);
  const sibRows = keep(input.siblings);
  const thisMachine = ownRows.map((r) => item(r, false));
  const sameModel = sibRows.map((r) => item(r, true));
  return {
    thisMachine,
    sameModel,
    keys,
    coverage: {
      thisMachine: ownRows.length,
      withNotes: ownRows.filter((r) => (closingNote(r)?.split(/\s+/).length ?? 0) >= 3).length,
      sameModel: sibRows.length,
      sameModelMachines: new Set(sibRows.map((r) => r.machineId)).size,
      templatesLeftOut,
    },
    safetyWords: safetyWords([
      input.problem,
      ...ownRows.flatMap((r) => [r.problem, r.closeNote, r.action, r.rootCause]).filter(isText),
    ]),
  };
}

const cleanKey = (k: string): string =>
  k.trim().replace(/^\[/, '').replace(/\]$/, '').toUpperCase();

/** The distinct ids that the cited keys map to. */
export function citedIds(answer: DiagnosisAnswer, keys: Record<string, string>): string[] {
  const ids = answer.candidates.flatMap((c) => c.evidence.map((k) => keys[cleanKey(k)]));
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

export function groundAnswer(
  answer: DiagnosisAnswer,
  ctx: {
    keys: Record<string, string>;
    visible: ReadonlySet<string>;
    coverage: DiagnosisCoverage;
    safetyWords: string[];
  },
): { output: DiagnosisOutputV1; evidenceTicketIds: string[]; dropped: number } {
  let dropped = 0;
  const candidates = answer.candidates.map((c) => {
    const ids: string[] = [];
    for (const raw of new Set(c.evidence.map(cleanKey))) {
      const id = ctx.keys[raw];
      if (id !== undefined && ctx.visible.has(id)) ids.push(id);
      else dropped += 1;
    }
    const evidenceTicketIds = ids.slice(0, 8);
    return {
      cause: c.cause,
      firstCheck: c.firstCheck,
      expectedFix: c.expectedFix,
      evidenceTicketIds,
      isGuess: evidenceTicketIds.length === 0,
    };
  });
  const byCode = !answer.safetyFlagged && ctx.safetyWords.length > 0;
  return {
    output: {
      v: 1,
      safetyFlagged: answer.safetyFlagged || ctx.safetyWords.length > 0,
      safetyReason: byCode
        ? `Notes on this machine or this report mention: ${ctx.safetyWords.join(', ')}.`
        : answer.safetyReason,
      safetyWords: ctx.safetyWords,
      candidates,
      coverage: ctx.coverage,
    },
    evidenceTicketIds: [...new Set(candidates.flatMap((c) => c.evidenceTicketIds))],
    dropped,
  };
}
