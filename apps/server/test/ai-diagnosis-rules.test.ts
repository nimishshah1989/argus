import { describe, expect, it } from 'vitest';
import { diagnosisOutputV1Schema, type DiagnosisCoverage } from '@uptimo/shared';
import {
  DIAGNOSIS_ANSWER_JSON_SCHEMA,
  buildEvidence,
  citedIds,
  diagnosisAnswerSchema,
  groundAnswer,
  safetyWords,
  type DiagnosisAnswer,
} from '../src/modules/ai/diagnosis-rules.js';
import type { HistoryRow } from '../src/modules/tickets/index.js';

let seq = 0;
function row(o: Partial<HistoryRow> = {}): HistoryRow {
  seq += 1;
  return {
    id: `62000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    machineId: 'm-own',
    reportedAt: new Date('2026-10-01T08:00:00Z'),
    problem: `Problem ${seq}`,
    closeNote: null,
    action: null,
    rootCause: null,
    spare: null,
    code: null,
    category: null,
    ...o,
  };
}

function evidence(o: Partial<Parameters<typeof buildEvidence>[0]> = {}) {
  return buildEvidence({
    problem: 'Spindle jam',
    own: [],
    siblings: [],
    siblingCodes: new Map(),
    seenElsewhere: new Set(),
    ...o,
  });
}

describe('buildEvidence', () => {
  it('numbers this machine first, then the same model, and omits blanks', () => {
    const a = row({ rootCause: '  ', problem: 'x'.repeat(700), action: 'Belt replaced' });
    const b = row({ rootCause: 'Worn belt' });
    const s = row({ machineId: 'm-sib', action: 'Belt noisy' });
    const e = evidence({ own: [a, b], siblings: [s], siblingCodes: new Map([['m-sib', 'FM-2']]) });
    expect(e.thisMachine.map((i) => i.key)).toEqual(['T1', 'T2']);
    expect(e.sameModel).toHaveLength(1);
    expect(e.sameModel[0]).toMatchObject({ key: 'T3', machine: 'FM-2', action: 'Belt noisy' });
    expect(e.keys).toEqual({ T1: a.id, T2: b.id, T3: s.id });
    expect(e.thisMachine[0]).not.toHaveProperty('rootCause');
    expect(e.thisMachine[0]?.problem).toHaveLength(500);
    expect(e.thisMachine[0]?.date).toBe('2026-10-01');
    expect(e.thisMachine[0]).not.toHaveProperty('machine');
  });

  it('merges repeated identical rows of one outage', () => {
    const same = { problem: 'Spindle band', action: 'Chalu kiya' };
    const e = evidence({
      own: [
        row(same),
        row(same),
        row(same),
        row({ ...same, reportedAt: new Date('2026-09-01T08:00:00Z') }),
      ],
    });
    expect(e.thisMachine).toHaveLength(2);
    expect(e.coverage.thisMachine).toBe(2);
  });

  it('leaves out stock notes seen on other models and keeps same-model patterns', () => {
    const e = evidence({
      own: [row({ action: 'Repaired' }), row({ action: 'Coupling aligned, bolts tightened' })],
      siblings: [row({ machineId: 'm-sib', action: 'Coupling aligned, bolts tightened' })],
      seenElsewhere: new Set(['repaired']),
    });
    expect([...e.thisMachine, ...e.sameModel].map((i) => i.action)).toEqual([
      'Coupling aligned, bolts tightened',
      'Coupling aligned, bolts tightened',
    ]);
    expect(e.coverage.templatesLeftOut).toBe(1);
  });

  it('counts only notes of three words or more as useful', () => {
    const e = evidence({
      own: [
        row({ action: 'Repaired' }),
        row({ action: 'OK now' }),
        row({ action: 'E' }),
        row({ action: 'Bearing was hot, replaced' }),
        row(),
      ],
      siblings: [row({ machineId: 's1' }), row({ machineId: 's2' })],
    });
    expect(e.coverage).toEqual({
      thisMachine: 5,
      withNotes: 1,
      sameModel: 2,
      sameModelMachines: 2,
      templatesLeftOut: 0,
    });
  });

  it("finds safety words in the report and this machine's notes only", () => {
    const e = evidence({
      problem: 'Machine band, temporary solution kiya tha',
      own: [
        row({ action: 'Door interlock bypassed' }),
        row({ closeNote: 'Jugad kari ne chalu karyu' }),
      ],
      siblings: [row({ machineId: 'm-sib', closeNote: 'short circuit' })],
    });
    expect(e.safetyWords).toEqual(['bypass', 'temporary fix', 'jugaad', 'interlock']);
    expect(safetyWords(['Coolant temperature high'])).toEqual([]);
  });
});

describe('groundAnswer', () => {
  const [a, b, c] = ['a', 'b', 'c'].map(
    (x) => `62000000-0000-4000-8000-00000000000${x.charCodeAt(0) - 96}`,
  ) as [string, string, string];
  const cand = (evidence: string[]) => ({
    cause: 'Worn belt 12',
    evidence,
    firstCheck: 'Check tension 3',
    expectedFix: 'Replace',
  });
  const base = (over: Partial<DiagnosisAnswer> = {}): DiagnosisAnswer => ({
    safetyFlagged: false,
    safetyReason: '',
    candidates: [],
    ...over,
  });
  const coverage: DiagnosisCoverage = {
    thisMachine: 4,
    withNotes: 2,
    sameModel: 3,
    sameModelMachines: 1,
    templatesLeftOut: 1,
  };
  const ctx = (over: Record<string, unknown> = {}) => ({
    keys: { T1: a, T2: b, T3: c },
    visible: new Set([a, b]),
    coverage,
    safetyWords: [] as string[],
    ...over,
  });

  it('keeps only cited keys that were sent and are still visible, and marks the rest guesses', () => {
    const answer = base({
      candidates: [
        cand(['T1', '[t2]', 'T1']),
        cand(['T3', 'T9', '62000000-0000-4000-8000-000000000001']),
        cand([]),
      ],
    });
    const r = groundAnswer(answer, ctx());
    expect(r.output.candidates.map((x) => x.evidenceTicketIds)).toEqual([[a, b], [], []]);
    expect(r.output.candidates.map((x) => x.isGuess)).toEqual([false, true, true]);
    expect(r.evidenceTicketIds).toEqual([a, b]);
    expect(r.dropped).toBe(3);
    expect(citedIds(answer, ctx().keys)).toEqual([a, b, c]);
  });

  it('raises the safety flag from notes even when the model does not', () => {
    const words = ['bypass'];
    const none = groundAnswer(
      base({ safetyReason: 'None of the safety triggers shown.' }),
      ctx({ safetyWords: words }),
    ).output;
    expect(none.safetyFlagged).toBe(true);
    expect(none.safetyReason).toBe('Notes on this machine or this report mention: bypass.');
    const kept = groundAnswer(
      base({ safetyFlagged: true, safetyReason: 'T3 says the guard was removed' }),
      ctx({ safetyWords: words }),
    ).output;
    expect(kept.safetyReason).toBe('T3 says the guard was removed');
    const quiet = groundAnswer(base({ safetyReason: 'Nothing' }), ctx()).output;
    expect(quiet).toMatchObject({ safetyFlagged: false, safetyReason: 'Nothing' });
  });

  it('stores only numbers that code computed', () => {
    const r = groundAnswer(
      base({ safetyFlagged: true, safetyReason: 'Guard 1 open', candidates: [cand(['T1'])] }),
      ctx({ safetyWords: ['guard'] }),
    );
    expect(diagnosisOutputV1Schema.parse(r.output)).toEqual(r.output);
    expect(r.output.coverage).toEqual(coverage);
    const numbers: string[] = [];
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'number') numbers.push(path);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(r.output, 'output');
    expect(numbers.filter((p) => p !== 'output.v' && !p.startsWith('output.coverage.'))).toEqual(
      [],
    );
  });
});

describe('diagnosis answer shape', () => {
  it('describes the answer strictly to the model and to zod', () => {
    type Node = {
      type?: string;
      additionalProperties?: unknown;
      required?: string[];
      properties?: Record<string, Node>;
      items?: Node;
    };
    const walk = (node: Node): void => {
      if (node.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect([...(node.required ?? [])].sort()).toEqual(
          Object.keys(node.properties ?? {}).sort(),
        );
        Object.values(node.properties ?? {}).forEach(walk);
      }
      if (node.items) walk(node.items);
    };
    walk(DIAGNOSIS_ANSWER_JSON_SCHEMA as Node);
    const cand = { cause: 'c', evidence: [], firstCheck: 'f', expectedFix: 'x' };
    const ok = { safetyFlagged: false, safetyReason: '', candidates: [cand] };
    expect(diagnosisAnswerSchema.safeParse(ok).success).toBe(true);
    expect(
      diagnosisAnswerSchema.safeParse({ ...ok, candidates: [cand, cand, cand, cand] }).success,
    ).toBe(false);
    expect(
      diagnosisAnswerSchema.safeParse({ ...ok, safetyFlagged: true, safetyReason: '  ' }).success,
    ).toBe(false);
    expect(diagnosisAnswerSchema.safeParse({ ...ok, confidence: 1 }).success).toBe(false);
    expect(
      diagnosisAnswerSchema.safeParse({
        ...ok,
        candidates: [{ ...cand, cause: 'Spindle bearing kharab, garam thai gayu' }],
      }).success,
    ).toBe(true);
  });
});
