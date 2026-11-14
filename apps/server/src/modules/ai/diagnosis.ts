import { readFileSync } from 'node:fs';
import type { PoolClient } from 'pg';
import { machineFamily } from '../plant/index.js';
import { machineHistory, notesSeenElsewhere, pdfTicketRow, refsByIds } from '../tickets/index.js';
import {
  DIAGNOSIS_ANSWER_JSON_SCHEMA,
  buildEvidence,
  citedIds,
  closingNote,
  diagnosisAnswerSchema,
  groundAnswer,
  normaliseNote,
  type DiagnosisAnswer,
} from './diagnosis-rules.js';
import type { AiFeature, AiGrounded, AiLoaded } from './suggest.js';

type Db = Pick<PoolClient, 'query'>;

const VERSION_LINE = /^<!-- prompt: diagnosis · version: ([a-z0-9.-]{1,40}) -->$/;

/** First line is the version marker. Further leading comment lines (credits) are not sent. */
function readPrompt(): { version: string; text: string } {
  const [first = '', ...rest] = readFileSync(
    new URL('./prompts/diagnosis.md', import.meta.url),
    'utf8',
  ).split('\n');
  const version = VERSION_LINE.exec(first.trim())?.[1];
  if (!version) throw new Error('AI prompt: diagnosis.md has no version line');
  while (rest[0]?.startsWith('<!--')) rest.shift();
  return { version, text: rest.join('\n').trim() };
}

export const DIAGNOSIS_PROMPT = readPrompt();

const EXAMPLE: DiagnosisAnswer = {
  safetyFlagged: false,
  safetyReason: 'None of the safety triggers shown.',
  candidates: [
    {
      cause:
        'Sample answer from the test provider: no AI key is set, so no real diagnosis was made.',
      evidence: [],
      firstCheck: 'Check the machine as usual.',
      expectedFix: 'None suggested.',
    },
  ],
};

const present = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  ) as Partial<T>;

async function load(tx: Db, tenantId: string, ticketId: string): Promise<AiLoaded | 'stale'> {
  const row = (await pdfTicketRow(tx, tenantId, ticketId))[0];
  if (!row || row.kind !== 'stopped' || ['closed', 'cancelled'].includes(row.status))
    return 'stale';
  const reportedAt = row.reported_at as Date;
  const family = row.machine_id ? await machineFamily(tx, tenantId, row.machine_id) : null;
  const siblingIds = family?.siblings.map((s) => s.id) ?? [];
  const history = (machineIds: string[], limit: number) =>
    family ? machineHistory(tx, tenantId, { machineIds, before: reportedAt, limit }) : [];
  const own = await history(family ? [family.machine.id] : [], 15);
  const siblings = await history(siblingIds, 10);
  const notes = [...own, ...siblings].map((r) => normaliseNote(closingNote(r)));
  const seenElsewhere = family
    ? await notesSeenElsewhere(tx, tenantId, {
        notes: [...new Set(notes.filter((n): n is string => n !== null))],
        outsideMachineIds: [family.machine.id, ...siblingIds],
      })
    : new Set<string>();
  const ev = buildEvidence({
    problem: row.problem,
    reportedAt,
    own,
    siblings,
    siblingCodes: new Map(family?.siblings.map((s) => [s.id, s.code])),
    seenElsewhere,
  });
  const machine = family
    ? {
        code: family.machine.code,
        ...present({
          make: family.machine.make,
          model: family.machine.model,
          category: family.machine.category,
        }),
      }
    : null;
  return {
    task: DIAGNOSIS_PROMPT.text,
    input: {
      ticket: { problem: row.problem, reported: reportedAt.toISOString().slice(0, 10), machine },
      thisMachine: ev.thisMachine,
      sameModel: ev.sameModel,
      coverage: ev.coverage,
    },
    evidence: ev.keys,
    facts: { coverage: ev.coverage, safetyWords: ev.safetyWords },
  };
}

async function ground(
  tx: Db,
  tenantId: string,
  answer: DiagnosisAnswer,
  loaded: AiLoaded,
): Promise<AiGrounded> {
  const keys = loaded.evidence ?? {};
  const visible = new Set((await refsByIds(tx, tenantId, citedIds(answer, keys))).keys());
  const facts = loaded.facts as unknown as Parameters<typeof groundAnswer>[1];
  const g = groundAnswer(answer, { ...facts, keys, visible });
  return {
    output: g.output as unknown as AiGrounded['output'],
    evidenceTicketIds: g.evidenceTicketIds,
    dropped: g.dropped,
  };
}

export const diagnosisFeature: AiFeature<DiagnosisAnswer> = {
  name: 'diagnosis',
  promptVersion: DIAGNOSIS_PROMPT.version,
  outputSchema: {
    name: 'diagnosis_answer',
    description: 'A safety flag and up to three likely causes.',
    jsonSchema: DIAGNOSIS_ANSWER_JSON_SCHEMA,
    zod: diagnosisAnswerSchema,
    example: EXAMPLE,
  },
  load,
  ground,
};
