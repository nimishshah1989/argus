import { randomUUID } from 'node:crypto';
import { PgBoss } from 'pg-boss';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AI_SUGGEST_QUEUE,
  AiProviderError,
  createFakeProvider,
  startAiJobs,
  type AiConfig,
  type AiFeature,
} from '../src/modules/ai/index.js';
import { APP_API_PASSWORD, startTestDb, type TestDb } from './harness.js';

const A = '63000000-0000-4000-8000-00000000000a';
const config: AiConfig = {
  production: false,
  apiKey: null,
  model: 'fake',
  priceInputUsdPerMtok: 1,
  priceOutputUsdPerMtok: 5,
  maxOutputTokens: 1024,
  defaultMonthlyCapUsd: 50,
  timeoutMs: 30_000,
};
const feature: AiFeature<{ answer: string }> = {
  name: 'diagnosis',
  promptVersion: 'test-1',
  outputSchema: {
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
  },
  load: async () => ({ task: 'Test task.', input: { problem: 'pump leaks' } }),
};

let db: TestDb;
let boss: PgBoss | undefined;

async function newBoss(): Promise<PgBoss> {
  const { container } = db;
  boss = new PgBoss({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
    migrate: false,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await boss.start();
  return boss;
}

async function newTicket(): Promise<string> {
  const id = randomUUID();
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($1, $2, $3, 'stopped', 'open', 'x', now(), 'S1')`,
    [id, A, `J-${id.slice(0, 8)}`],
  );
  return id;
}

const payloadFor = (ticket: string) => ({
  v: 1,
  tenantId: A,
  feature: 'diagnosis',
  subjectType: 'ticket',
  subjectId: ticket,
  promptVersion: 'test-1',
});

async function waitFor<T>(read: () => Promise<T | undefined>, ms = 10_000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('timed out');
}

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query(`INSERT INTO tenant (id, slug, name) VALUES ($1, 'ai-jobs', 'Jobs Plant')`, [
    A,
  ]);
}, 120_000);

afterEach(async () => {
  await boss?.stop();
  boss = undefined;
});

afterAll(async () => {
  await db.stop();
});

it('runs ai.suggest through pg-boss and schedules its own retry in the same transaction', async () => {
  const ticket = await newTicket();
  const fake = createFakeProvider([
    new AiProviderError('rate_limited'),
    { output: { answer: 'ok' } },
  ]);
  const features = { diagnosis: feature as AiFeature<unknown> };
  const b = await newBoss();
  await startAiJobs(b, { pool: db.app, config, provider: fake, features }, 'all');
  await b.send(AI_SUGGEST_QUEUE, payloadFor(ticket));
  const jobs = await waitFor(async () => {
    const result = await db.admin.query(
      `SELECT start_after, started_on FROM pgboss.job WHERE name = $1 ORDER BY created_on`,
      [AI_SUGGEST_QUEUE],
    );
    return result.rows.length >= 2 ? result.rows : undefined;
  });
  const gap = (jobs[1].start_after.getTime() - jobs[0].started_on.getTime()) / 1000;
  expect(gap).toBeGreaterThan(55);
  expect(gap).toBeLessThan(65);
  const stored = await db.admin.query(
    'SELECT status, outcome FROM ai_suggestion WHERE ticket_id = $1',
    [ticket],
  );
  expect(stored.rows[0]).toEqual({ status: 'retry_wait', outcome: 'rate_limited' });
});

it('creates the queue but runs no worker for the api role', async () => {
  const fake = createFakeProvider();
  const features = { diagnosis: feature as AiFeature<unknown> };
  const b = await newBoss();
  await startAiJobs(b, { pool: db.app, config, provider: fake, features }, 'api');
  const id = await b.send(AI_SUGGEST_QUEUE, payloadFor(await newTicket()));
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const state = (await db.admin.query('SELECT state FROM pgboss.job WHERE id = $1', [id])).rows[0]
    ?.state;
  expect(state).toBe('created');
  expect(fake.calls).toHaveLength(0);
});

it('runs a diagnosis job with the default features', async () => {
  const ticket = await newTicket();
  const b = await newBoss();
  await startAiJobs(b, { pool: db.app, config, provider: createFakeProvider() }, 'all');
  await b.send(AI_SUGGEST_QUEUE, { ...payloadFor(ticket), promptVersion: 'diagnosis-1' });
  const row = await waitFor(async () => {
    const result = await db.admin.query(
      'SELECT status, prompt_version FROM ai_suggestion WHERE ticket_id = $1',
      [ticket],
    );
    return result.rows[0]?.status === 'ready' ? result.rows[0] : undefined;
  });
  expect(row).toEqual({ status: 'ready', prompt_version: 'diagnosis-1' });
});
