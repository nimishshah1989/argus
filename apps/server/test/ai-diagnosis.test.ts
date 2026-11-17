import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { diagnosisOutputV1Schema, type AiSuggestPayload } from '@uptimo/shared';
import {
  createFakeProvider,
  pickProvider,
  type AiConfig,
  type AiFeature,
  type AiProvider,
} from '../src/modules/ai/index.js';
import { DIAGNOSIS_PROMPT, diagnosisFeature } from '../src/modules/ai/diagnosis.js';
import { runSuggest, type AiLogLine, type AiRuntime } from '../src/modules/ai/suggest.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '72b00000-0000-4000-8000-00000000000a';
const B = '72b00000-0000-4000-8000-00000000000b';
const mid = (n: number): string =>
  `72b00000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const [M, S, O, O2, O3, N, MB] = [1, 2, 3, 4, 5, 6, 7].map(mid) as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
const NOW = new Date('2026-11-13T10:00:00Z');
const PHONE = '+919000000101';
const config: AiConfig = {
  production: false,
  residencyRecord: null,
  apiKey: null,
  model: 'fake',
  priceInputUsdPerMtok: 1,
  priceOutputUsdPerMtok: 5,
  maxOutputTokens: 1024,
  defaultMonthlyCapUsd: 50,
  timeoutMs: 30_000,
};
const NONE = 'None of the safety triggers shown.';
const reply = (candidates: object[], safetyFlagged = false, safetyReason = NONE) => ({
  output: { safetyFlagged, safetyReason, candidates },
});
const cand = (cause: string, evidence: string[]) => ({
  cause,
  evidence,
  firstCheck: 'Check it',
  expectedFix: 'Fix it',
});

describe('diagnosis feature', () => {
  let db: TestDb;
  let logs: AiLogLine[];
  let n = 0;

  async function ticket(
    tenant: string,
    machine: string | null,
    reportedAt: string,
    o: {
      status?: string;
      kind?: string;
      problem?: string;
      closeNote?: string;
      action?: string;
    } = {},
  ): Promise<string> {
    n += 1;
    const t = (
      await db.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, close_note, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'S1') RETURNING id`,
        [
          tenant,
          `D-${n}`,
          o.kind ?? 'stopped',
          o.status ?? 'closed',
          machine,
          o.problem ?? `Old problem ${n}`,
          reportedAt,
          o.closeNote ?? null,
        ],
      )
    ).rows[0].id as string;
    if (o.action)
      await db.admin.query(
        `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, corrective_action, observed_by, handover_name, submitted_at)
         VALUES ($1, $2, $3, '2026-10-01', 'A', 'p', $4, 'Ravi Fake', 'Mina Fake', $5)`,
        [tenant, t, machine, o.action, reportedAt],
      );
    return t;
  }

  const subject = (machine: string | null = M, tenant = A, over = {}) =>
    ticket(tenant, machine, '2026-11-13T09:00:00Z', {
      status: 'open',
      problem: 'Spindle jam, operator says same as last time',
      ...over,
    });

  const payload = (subjectId: string): AiSuggestPayload => ({
    v: 1,
    tenantId: A,
    feature: 'diagnosis',
    subjectType: 'ticket',
    subjectId,
    promptVersion: 'diagnosis-1',
  });

  const runtime = (provider: AiProvider): AiRuntime => ({
    pool: db.app,
    boss: { send: (async () => 'job') as unknown as AiRuntime['boss']['send'] },
    config,
    provider,
    features: { diagnosis: diagnosisFeature as AiFeature<unknown> },
    now: () => NOW,
    log: (line) => logs.push(line),
  });

  const rows = async (id: string) =>
    (await db.admin.query('SELECT * FROM ai_suggestion WHERE ticket_id = $1', [id])).rows;

  /** History of tests 15-17. old1 and old2 are inside the 30-day safety scan, the third is not. */
  async function history() {
    const old1 = await ticket(A, M, '2026-10-25T08:00:00Z', {
      action: 'Spindle bearing replaced, alignment checked',
    });
    await ticket(A, M, '2026-10-15T08:00:00Z', {
      closeNote: 'Ravi Fake reset the drive, bypass wire left',
    });
    await ticket(A, M, '2026-08-01T08:00:00Z', { action: 'Repaired' });
    for (const [i, m] of [O, O2, O3].entries())
      await ticket(A, m, `2026-08-02T0${i}:00:00Z`, { closeNote: 'Repaired' });
    await ticket(A, S, '2026-07-01T08:00:00Z', { action: 'Spindle bearing noisy, replaced' });
    await ticket(A, M, '2026-11-20T08:00:00Z', { action: 'Future fix' });
    await ticket(A, M, '2026-10-30T08:00:00Z', { status: 'cancelled' }); // not closed: left out
    return { old1 };
  }

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      `INSERT INTO tenant (id, slug, name) VALUES ($1, 'dg-a', 'Test Plant A'), ($2, 'dg-b', 'Test Plant B')`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO machine (id, tenant_id, code, make, model) VALUES
        ($1, $8, 'FM-1', 'Fake Make', 'FM-100'), ($2, $8, 'FM-2', ' fake make ', 'fm-100'),
        ($3, $8, 'OT-1', 'Other Make', 'OT-5'), ($4, $8, 'OT-2', 'Other Make', 'OT-5'),
        ($5, $8, 'OT-3', 'Other Make', 'OT-5'), ($6, $8, 'BARE-1', NULL, NULL),
        ($7, $9, 'FM-9', 'Fake Make', 'FM-100')`,
      [M, S, O, O2, O3, N, MB, A, B],
    );
    await db.admin.query(
      `INSERT INTO person (tenant_id, name, short_name, phone, active)
       VALUES ($1, 'Ravi Fake', 'Ravi', $2, true)`,
      [A, PHONE],
    );
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    logs = [];
    await db.admin.query('DELETE FROM ai_suggestion');
    await db.admin.query(`DELETE FROM setting WHERE key = 'ai.consent'`);
    await db.admin.query(
      `DELETE FROM breakdown_report WHERE ticket_id IN (SELECT id FROM ticket WHERE ref LIKE 'D-%')`,
    );
    await db.admin.query(`DELETE FROM ticket WHERE ref LIKE 'D-%'`);
  });

  it('stores a grounded diagnosis and logs dropped evidence', async () => {
    const { old1 } = await history();
    const id = await subject();
    const fake = createFakeProvider([
      reply([cand('Bearing failing again', ['T1', 'T9']), cand('Drive fault', [])]),
    ]);
    expect(await runSuggest(payload(id), runtime(fake))).toBe('ok');
    const [row] = await rows(id);
    expect(row).toMatchObject({
      status: 'ready',
      outcome: 'ok',
      mode: 'shadow',
      prompt_version: 'diagnosis-1',
      evidence_ticket_ids: [old1],
    });
    const out = diagnosisOutputV1Schema.parse(row.output);
    expect(out.candidates[0]).toMatchObject({ evidenceTicketIds: [old1], isGuess: false });
    expect(out.candidates[1]).toMatchObject({ evidenceTicketIds: [], isGuess: true });
    expect(out.safetyFlagged).toBe(true);
    expect(out.safetyWords).toEqual(['bypass']);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ evidenceDropped: 1 });
  });

  it('sends the prompt and redacted history, never ids or names', async () => {
    await history();
    const fake = createFakeProvider();
    await runSuggest(payload(await subject()), runtime(fake));
    const call = fake.calls[0]!;
    expect(call.task).toBe(DIAGNOSIS_PROMPT.text);
    const input = call.input as {
      thisMachine: { key: string }[];
      sameModel: { key: string; machine: string }[];
      coverage: { templatesLeftOut: number };
    };
    expect(input.thisMachine.map((i) => i.key)).toEqual(['T1', 'T2']);
    expect(input.coverage.templatesLeftOut).toBe(1);
    expect(input.sameModel).toMatchObject([{ machine: 'FM-2', key: 'T3' }]);
    const text = JSON.stringify(call);
    expect(text).not.toContain('Future fix');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    for (const secret of ['Ravi Fake', 'Mina Fake', PHONE]) expect(text).not.toContain(secret);
    expect(text).toContain('[P1] reset the drive');
  });

  it('through the real Claude adapter: the whole request is the redacted input, nothing else leaves', async () => {
    await db.admin.query(
      `INSERT INTO person (tenant_id, name, short_name, active) VALUES ($1, 'Trial Fake', 'Trial', true)`,
      [A],
    );
    const { old1 } = await history();
    await ticket(A, M, '2026-10-20T08:00:00Z', {
      closeNote: 'Trial re-seated the encoder, bypass wire left',
    });
    const reference = createFakeProvider();
    const first = await subject();
    await runSuggest(payload(first), runtime(reference));
    const redactedInput = JSON.stringify(reference.calls[0]!.input);
    expect(redactedInput).toContain('[P');
    expect(redactedInput).not.toContain('Trial');
    await db.admin.query('DELETE FROM ai_suggestion');
    await db.admin.query('DELETE FROM ticket WHERE id = $1', [first]);
    const id = await subject();
    const sent: { url: string; body: string }[] = [];
    const answer = reply([cand('Bearing failing again', ['T1', 'T9'])]).output;
    const fetchImpl = (async (url: string, init: { body: string }) => {
      sent.push({ url, body: init.body });
      return new Response(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(answer) }],
          usage: { input_tokens: 900, output_tokens: 120 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const real = pickProvider(
      { ...config, apiKey: 'key-placeholder', model: 'claude-sonnet-5-5' },
      fetchImpl,
    )!;
    await db.admin.query(
      `INSERT INTO setting (tenant_id, key, value) VALUES ($1, 'ai.consent', $2)`,
      [
        A,
        JSON.stringify({
          status: 'granted',
          signedOn: '2026-11-01',
          fileId: '72b00000-0000-4000-8000-0000000000f1',
          wordingVersion: 'v1',
          recordedByLoginId: '72b00000-0000-4000-8000-0000000000f2',
        }),
      ],
    );
    expect(
      await runSuggest(payload(id), {
        ...runtime(real),
        config: { ...config, apiKey: 'key-placeholder' },
      }),
    ).toBe('ok');
    expect(sent).toHaveLength(1);
    expect(new URL(sent[0]!.url).host).toBe('api.anthropic.com');
    const body = JSON.parse(sent[0]!.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'max_tokens',
      'messages',
      'model',
      'output_config',
      'system',
    ]);
    expect(body.system).toBe(DIAGNOSIS_PROMPT.text);
    expect(body.messages).toEqual([{ role: 'user', content: redactedInput }]);
    for (const secret of ['Ravi Fake', 'Trial', PHONE, 'Test Plant A'])
      expect(sent[0]!.body).not.toContain(secret);
    expect(sent[0]!.body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    const [row] = await rows(id);
    expect(row).toMatchObject({
      mode: 'shadow',
      evidence_ticket_ids: [old1],
      model_ref: 'claude-sonnet-5-5',
      cost_micro_usd: '1500',
    });
    expect(logs.at(-1)).toMatchObject({ evidenceDropped: 1, inputTokens: 900, outputTokens: 120 });
  });

  it('drops evidence the tenant can no longer see', async () => {
    const { old1 } = await history();
    const id = await subject();
    const foreign = await ticket(B, MB, '2026-10-01T08:00:00Z');
    const provider: AiProvider = {
      modelRef: 'fake',
      async complete() {
        await db.admin.query('DELETE FROM breakdown_report WHERE ticket_id = $1', [old1]);
        await db.admin.query('DELETE FROM ticket WHERE id = $1', [old1]);
        return {
          output: reply([cand('Bearing', ['T1', foreign])]).output,
          usage: { inputTokens: 0, outputTokens: 0 },
          modelRef: 'fake',
        } as never;
      },
    };
    expect(await runSuggest(payload(id), runtime(provider))).toBe('ok');
    const [row] = await rows(id);
    expect(row.output.candidates[0]).toMatchObject({ evidenceTicketIds: [], isGuess: true });
    expect(row.evidence_ticket_ids).toEqual([]);
    expect(logs[0]).toMatchObject({ evidenceDropped: 2 });
  });

  it("skips a closed, cancelled or non-breakdown ticket and another tenant's ticket", async () => {
    const fake = createFakeProvider();
    const stale = [
      await subject(M, A, { status: 'closed' }),
      await subject(M, A, { status: 'cancelled' }),
      await subject(M, A, { kind: 'general' }),
      await subject(MB, B),
    ];
    for (const id of stale) expect(await runSuggest(payload(id), runtime(fake))).toBe('stale');
    expect(fake.calls).toHaveLength(0);
    expect((await db.admin.query('SELECT 1 FROM ai_suggestion')).rows).toHaveLength(0);
  });

  it('makes an honest guess when there is no history', async () => {
    const fake = createFakeProvider();
    const id = await subject(N);
    expect(await runSuggest(payload(id), runtime(fake))).toBe('ok');
    const input = fake.calls[0]!.input as {
      thisMachine: unknown[];
      sameModel: unknown[];
      coverage: Record<string, number>;
      ticket: { machine: Record<string, string> };
    };
    expect(input.thisMachine).toEqual([]);
    expect(input.sameModel).toEqual([]);
    expect(Object.values(input.coverage)).toEqual([0, 0, 0, 0, 0]);
    expect(input.ticket.machine).toEqual({ code: 'BARE-1' });
    const [row] = await rows(id);
    expect(row.output.candidates[0].isGuess).toBe(true);
    expect(row.output.candidates[0].cause).toContain('Sample answer');
  });

  it("flags safety from this machine's notes even when the model says none", async () => {
    await ticket(A, M, '2026-10-15T08:00:00Z', { closeNote: 'Reset the drive, bypass wire left' });
    const id = await subject();
    await runSuggest(payload(id), runtime(createFakeProvider([reply([cand('Drive', [])])])));
    expect((await rows(id))[0].output).toMatchObject({
      safetyFlagged: true,
      safetyWords: ['bypass'],
      safetyReason: 'Notes on this machine or this report mention: bypass.',
    });
  });

  it('loads a versioned prompt with the safety and citation rules', () => {
    expect(DIAGNOSIS_PROMPT.version).toBe('diagnosis-1');
    expect(diagnosisFeature.promptVersion).toBe(DIAGNOSIS_PROMPT.version);
    expect(DIAGNOSIS_PROMPT.text.startsWith('<!--')).toBe(false);
    for (const word of [
      'bypass',
      'interlock',
      'stored energy',
      'restarting',
      'guess',
      '[P1]',
      'at most three',
    ])
      expect(DIAGNOSIS_PROMPT.text).toContain(word);
  });
});
