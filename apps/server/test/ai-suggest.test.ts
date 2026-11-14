import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AiSuggestPayload } from '@uptimo/shared';
import {
  AiProviderError,
  aiConfigFromEnv,
  createFakeProvider,
  pickProvider,
  type AiConfig,
  type AiFeature,
  type AiProvider,
  type FakeReply,
} from '../src/modules/ai/index.js';
import { runSuggest, type AiLogLine, type AiRuntime } from '../src/modules/ai/suggest.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '62000000-0000-4000-8000-00000000000a';
const B = '62000000-0000-4000-8000-00000000000b';
const NOW = new Date('2026-11-13T10:00:00Z');
const PROBLEM = 'Ravi Fake (ravi.f, +919000000101) at Test Plant A says the pump leaks';
const PHONE = '+919000000101';

const outputSchema = {
  name: 'record_answer',
  description: 'Record the answer.',
  jsonSchema: {
    type: 'object',
    properties: { answer: { type: 'string' } },
    required: ['answer'],
    additionalProperties: false,
  },
  zod: z.object({ answer: z.string() }),
  example: { answer: 'example' },
};

const testFeature: AiFeature<{ answer: string }> = {
  name: 'diagnosis',
  promptVersion: 'test-1',
  outputSchema,
  async load(tx, tenantId, subjectId) {
    const row = (await tx.query('SELECT problem, status FROM ticket WHERE id = $1', [subjectId]))
      .rows[0];
    if (!row || ['closed', 'cancelled'].includes(row.status)) return 'stale';
    return { task: 'Test task.', input: { problem: row.problem } };
  },
};

const baseConfig: AiConfig = {
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

const ok = (answer: string, inputTokens = 0, outputTokens = 0): FakeReply => ({
  output: { answer },
  usage: { inputTokens, outputTokens },
});

describe('ai suggest job', () => {
  let db: TestDb;
  let sent: { name: string; data: unknown; startAfter: number | undefined }[];
  let logs: AiLogLine[];

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      `INSERT INTO tenant (id, slug, name) VALUES ($1, 'ai-a', 'Test Plant A'), ($2, 'ai-b', 'Test Plant B')`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO person (tenant_id, name, short_name, phone, active)
       VALUES ($1, 'Ravi Fake', 'Ravi', $2, true)`,
      [A, PHONE],
    );
    await db.admin.query(
      `INSERT INTO login (tenant_id, username, password_hash, role)
       VALUES ($1, 'ravi.f', 'hash', 'technician')`,
      [A],
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    sent = [];
    logs = [];
    await db.admin.query('DELETE FROM ai_suggestion');
    await db.admin.query(`DELETE FROM setting WHERE key LIKE 'ai.%'`);
  });

  async function makeTicket(
    tenantId = A,
    over: { status?: string; problem?: string } = {},
  ): Promise<string> {
    const id = randomUUID();
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, $3, 'stopped', $4, $5, $6, 'S1')`,
      [id, tenantId, `AI-${id.slice(0, 8)}`, over.status ?? 'open', over.problem ?? PROBLEM, NOW],
    );
    return id;
  }

  const payload = (ticketId: string, over: Partial<AiSuggestPayload> = {}): AiSuggestPayload => ({
    v: 1,
    tenantId: A,
    feature: 'diagnosis',
    subjectType: 'ticket',
    subjectId: ticketId,
    promptVersion: 'test-1',
    ...over,
  });

  function runtime(provider: AiProvider | null, over: Partial<AiRuntime> = {}): AiRuntime {
    return {
      pool: db.app,
      boss: {
        send: (async (name: string, data: unknown, options?: { startAfter?: number }) => {
          sent.push({ name, data, startAfter: options?.startAfter });
          return 'job-id';
        }) as unknown as AiRuntime['boss']['send'],
      },
      config: baseConfig,
      provider,
      features: { diagnosis: testFeature as AiFeature<unknown> },
      now: () => NOW,
      log: (line) => logs.push(line),
      ...over,
    };
  }

  async function rows(ticketId?: string) {
    const result = await db.admin.query(
      `SELECT * FROM ai_suggestion ${ticketId ? 'WHERE ticket_id = $1' : ''} ORDER BY created_at`,
      ticketId ? [ticketId] : [],
    );
    return result.rows;
  }

  async function spendRow(cost: number, createdAt = '2026-11-13T09:00:00Z') {
    const other = await makeTicket(A, { problem: 'other' });
    await db.admin.query(
      `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
         prompt_version, model_ref, status, outcome, cost_micro_usd, created_at, updated_at)
       VALUES ($1, 'diagnosis', 'ticket', $2::text, $2::uuid, 'other', 'fake', 'failed', 'provider_error', $3, $4, $4)`,
      [A, other, cost, createdAt],
    );
  }

  async function setSetting(key: string, value: unknown) {
    await db.admin.query(`INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)`, [
      A,
      key,
      JSON.stringify(value),
    ]);
  }

  const consent = {
    status: 'granted',
    signedOn: '2026-11-01',
    fileId: randomUUID(),
    wordingVersion: 'v1',
    recordedByLoginId: randomUUID(),
  };

  it('stores a ready suggestion with tokens and cost and logs ok', async () => {
    const ticket = await makeTicket();
    const fake = createFakeProvider([ok('check the belt', 1000, 200)]);
    expect(await runSuggest(payload(ticket), runtime(fake))).toBe('ok');
    expect(fake.calls).toHaveLength(1);
    const [row] = await rows(ticket);
    expect(row).toMatchObject({
      status: 'ready',
      outcome: 'ok',
      mode: 'shadow',
      attempts: 1,
      input_tokens: 1000,
      output_tokens: 200,
      model_ref: 'fake',
      ticket_id: ticket,
      subject_id: ticket,
      output: { answer: 'check the belt' },
    });
    expect(Number(row.cost_micro_usd)).toBe(2000);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ outcome: 'ok', suggestionId: row.id, attempt: 1 });
  });

  it('sends no name, username, phone or plant name to the provider', async () => {
    const fake = createFakeProvider();
    await runSuggest(payload(await makeTicket()), runtime(fake));
    const sentText = JSON.stringify(fake.calls[0]);
    for (const secret of ['Ravi Fake', 'ravi.f', PHONE, 'Test Plant A']) {
      expect(sentText).not.toContain(secret);
    }
    expect(sentText).toContain('pump leaks');
  });

  it('calls the provider once for two jobs with one key', async () => {
    const ticket = await makeTicket();
    const fake = createFakeProvider();
    const run = () => runSuggest(payload(ticket), runtime(fake));
    const outcomes = await Promise.all([run(), run()]);
    expect([...outcomes].sort()).toEqual(['duplicate', 'ok']);
    expect(fake.calls).toHaveLength(1);
    expect(await rows(ticket)).toHaveLength(1);
  });

  it('stops on a surviving term, records it once and never calls the provider', async () => {
    const ticket = await makeTicket();
    const fake = createFakeProvider();
    const leaky: AiFeature<unknown> = {
      ...(testFeature as AiFeature<unknown>),
      load: async () => ({ task: 'Ask Ravi Fake about it.', input: { problem: 'x' } }),
    };
    const rt = runtime(fake, { features: { diagnosis: leaky } });
    expect(await runSuggest(payload(ticket), rt)).toBe('redaction_failed');
    expect(fake.calls).toHaveLength(0);
    const [row] = await rows(ticket);
    expect(row).toMatchObject({
      status: 'failed',
      outcome: 'redaction_failed',
      attempts: 0,
      input_tokens: 0,
      output_tokens: 0,
    });
    expect(await runSuggest(payload(ticket), rt)).toBe('duplicate');
    expect(fake.calls).toHaveLength(0);
    expect(logs.filter((line) => line.outcome === 'redaction_failed')).toHaveLength(1);
  });

  it('uses the fake provider and records the call when no key is configured', async () => {
    const ticket = await makeTicket();
    const fake = pickProvider(aiConfigFromEnv({ APP_ENV: 'staging' }));
    expect(fake).not.toBeNull();
    await runSuggest(payload(ticket), runtime(fake));
    expect((fake as ReturnType<typeof createFakeProvider>).calls).toHaveLength(1);
    expect((await rows(ticket))[0]?.model_ref).toBe('fake');
  });

  it('makes no call and no row in production without granted consent', async () => {
    await setSetting('ai.monthlyCapUsd', 50);
    const cases: [string, unknown][] = [
      ['none', undefined],
      ['withdrawn', { ...consent, status: 'withdrawn' }],
      ['malformed', { status: 'granted' }],
    ];
    for (const [, value] of cases) {
      await db.admin.query(`DELETE FROM setting WHERE key = 'ai.consent'`);
      if (value !== undefined) await setSetting('ai.consent', value);
      const fake = createFakeProvider();
      const rt = runtime(fake, { config: { ...baseConfig, production: true, residencyRecord: 'record-1' } });
      expect(await runSuggest(payload(await makeTicket()), rt)).toBe('no_consent');
      expect(fake.calls).toHaveLength(0);
    }
    expect(await rows()).toHaveLength(0);
  });

  it('makes no call and no row in production until the residency record is filed', async () => {
    await setSetting('ai.consent', consent);
    await setSetting('ai.monthlyCapUsd', 50);
    const fake = createFakeProvider();
    const unfiled = { ...baseConfig, production: true, residencyRecord: null };
    const ticket = await makeTicket();
    expect(await runSuggest(payload(ticket), runtime(fake, { config: unfiled }))).toBe(
      'no_residency',
    );
    expect(fake.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
    expect(logs.at(-1)).toMatchObject({ outcome: 'no_residency' });
    const filed = { ...unfiled, residencyRecord: 'record-1' };
    expect(await runSuggest(payload(ticket), runtime(fake, { config: filed }))).toBe('ok');
  });

  it('makes no call and no row in production without a cap or over the cap', async () => {
    await setSetting('ai.consent', consent);
    const production = { ...baseConfig, production: true, residencyRecord: 'record-1' };
    const fake = createFakeProvider();
    const start = await rows();
    expect(
      await runSuggest(payload(await makeTicket()), runtime(fake, { config: production })),
    ).toBe('cap_reached');
    expect(await rows()).toHaveLength(start.length);
    await setSetting('ai.monthlyCapUsd', 1);
    await spendRow(1_000_000);
    const before = await rows();
    expect(
      await runSuggest(payload(await makeTicket()), runtime(fake, { config: production })),
    ).toBe('cap_reached');
    expect(fake.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(before.length);
    expect(sent).toHaveLength(0);
  });

  it('ignores consent outside production and applies the default cap', async () => {
    const first = createFakeProvider();
    expect(await runSuggest(payload(await makeTicket()), runtime(first))).toBe('ok');
    await db.admin.query('DELETE FROM ai_suggestion');
    await spendRow(49_999_000);
    const second = createFakeProvider();
    expect(await runSuggest(payload(await makeTicket()), runtime(second))).toBe('cap_reached');
    expect(second.calls).toHaveLength(0);
  });

  it('counts only this UTC month toward the cap', async () => {
    await spendRow(50_000_000, '2026-10-31T23:59:59Z');
    expect(await runSuggest(payload(await makeTicket()), runtime(createFakeProvider()))).toBe('ok');
  });

  it('skips a closed or cancelled ticket, an unknown feature and an old prompt version', async () => {
    const fake = createFakeProvider();
    const closed = await makeTicket(A, { status: 'closed' });
    expect(await runSuggest(payload(closed), runtime(fake))).toBe('stale');
    const open = await makeTicket();
    expect(await runSuggest(payload(open), runtime(fake, { features: {} }))).toBe('feature_off');
    expect(await runSuggest(payload(open, { promptVersion: 'test-0' }), runtime(fake))).toBe(
      'feature_off',
    );
    expect(fake.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });

  it('reads only the tenant named in the payload', async () => {
    const theirs = await makeTicket(B);
    const fake = createFakeProvider();
    expect(await runSuggest(payload(theirs, { tenantId: A }), runtime(fake))).toBe('stale');
    expect(fake.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });

  it('follows the table for a 429, a 529 and then an invalid reply', async () => {
    const ticket = await makeTicket();
    const fake = createFakeProvider([
      new AiProviderError('rate_limited'),
      new AiProviderError('overloaded'),
      { output: { answer: 7 }, usage: { inputTokens: 40, outputTokens: 5 } },
    ]);
    const rt = runtime(fake);
    const outcomes = [await runSuggest(payload(ticket), rt)];
    outcomes.push(await runSuggest(sent[0]?.data, rt));
    outcomes.push(await runSuggest(sent[1]?.data, rt));
    expect(outcomes).toEqual(['rate_limited', 'overloaded', 'schema_invalid']);
    expect(sent.map((job) => job.startAfter)).toEqual([60, 120]);
    expect(fake.calls).toHaveLength(3);
    const [row] = await rows(ticket);
    expect(row).toMatchObject({
      status: 'failed',
      outcome: 'schema_invalid',
      attempts: 3,
      input_tokens: 40,
      output_tokens: 5,
    });
  });

  it('retries a provider error at 30 s and 2 min, then fails; rejects without retry', async () => {
    const ticket = await makeTicket();
    const fake = createFakeProvider([1, 2, 3].map(() => new AiProviderError('provider_error')));
    const rt = runtime(fake);
    await runSuggest(payload(ticket), rt);
    await runSuggest(payload(ticket), rt);
    await runSuggest(payload(ticket), rt);
    expect(sent.map((job) => job.startAfter)).toEqual([30, 120]);
    expect((await rows(ticket))[0]).toMatchObject({
      status: 'failed',
      outcome: 'provider_error',
      attempts: 3,
    });
    sent.length = 0;
    const rejected = await makeTicket();
    const fake2 = createFakeProvider([new AiProviderError('provider_rejected')]);
    await runSuggest(payload(rejected), runtime(fake2));
    expect(sent).toHaveLength(0);
    expect((await rows(rejected))[0]).toMatchObject({
      status: 'failed',
      outcome: 'provider_rejected',
      attempts: 1,
    });
  });

  it('holds no database connection while the provider runs', async () => {
    let busy = -1;
    const fake = createFakeProvider([
      () => {
        busy = db.app.totalCount - db.app.idleCount;
        return { output: { answer: 'x' } };
      },
    ]);
    await runSuggest(payload(await makeTicket()), runtime(fake));
    expect(busy).toBe(0);
  });

  it('re-runs a job whose process died mid-call, within the four-call ceiling', async () => {
    const seed = async (attempts: number, updatedAt: string) => {
      const ticket = await makeTicket();
      await db.admin.query(
        `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
           prompt_version, model_ref, status, attempts, created_at, updated_at)
         VALUES ($1, 'diagnosis', 'ticket', $2::text, $2::uuid, 'test-1', 'fake', 'running', $3, $4, $4)`,
        [A, ticket, attempts, updatedAt],
      );
      return ticket;
    };
    const fake = createFakeProvider();
    const rt = runtime(fake);
    const stale = await seed(1, '2026-11-13T09:58:29Z');
    expect(await runSuggest(payload(stale), rt)).toBe('ok');
    expect(fake.calls).toHaveLength(1);
    expect((await rows(stale))[0]?.attempts).toBe(2);
    const fresh = await seed(1, '2026-11-13T09:59:50Z');
    expect(await runSuggest(payload(fresh), rt)).toBe('duplicate');
    expect(fake.calls).toHaveLength(1);
    const spent = await seed(4, '2026-11-13T09:58:29Z');
    expect(await runSuggest(payload(spent), rt)).toBe('provider_error');
    expect(fake.calls).toHaveLength(1);
    expect((await rows(spent))[0]).toMatchObject({ status: 'failed', outcome: 'provider_error' });
  });

  it('logs one line per job with only the D22 fields', async () => {
    const keyed = { ...baseConfig, apiKey: 'fake-key-for-tests' };
    const leaky: AiFeature<unknown> = {
      ...(testFeature as AiFeature<unknown>),
      load: async () => ({ task: 'Ask Ravi Fake about it.', input: { problem: 'x' } }),
    };
    await runSuggest(payload(await makeTicket()), runtime(createFakeProvider(), { config: keyed }));
    await runSuggest(
      payload(await makeTicket()),
      runtime(createFakeProvider(), { config: keyed, features: { diagnosis: leaky } }),
    );
    await db.admin.query('DELETE FROM ai_suggestion');
    await spendRow(50_000_000);
    await runSuggest(payload(await makeTicket()), runtime(createFakeProvider(), { config: keyed }));
    expect(logs.map((line) => line.outcome)).toEqual(['ok', 'redaction_failed', 'cap_reached']);
    const keys = [
      'tenantId',
      'module',
      'job',
      'feature',
      'promptVersion',
      'modelRef',
      'suggestionId',
      'attempt',
      'inputTokens',
      'outputTokens',
      'costMicroUsd',
      'outcome',
      'evidenceDropped',
      'durationMs',
    ];
    for (const line of logs) {
      expect(Object.keys(line).sort()).toEqual([...keys].sort());
      const text = JSON.stringify(line);
      for (const secret of ['pump leaks', 'Ravi Fake', PHONE, 'Test task', 'fake-key-for-tests']) {
        expect(text).not.toContain(secret);
      }
    }
  });

  it('makes no call and stores no row when there is no provider', async () => {
    expect(await runSuggest(payload(await makeTicket()), runtime(null))).toBe('no_provider');
    expect(await rows()).toHaveLength(0);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ outcome: 'no_provider', modelRef: 'none' });
  });

  it('rejects an invalid payload before touching the database', async () => {
    const fake = createFakeProvider();
    const bad = Object.fromEntries(
      Object.entries(payload(await makeTicket())).filter(([key]) => key !== 'tenantId'),
    );
    await expect(runSuggest(bad, runtime(fake))).rejects.toThrow();
    expect(fake.calls).toHaveLength(0);
    expect(logs).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });
});
