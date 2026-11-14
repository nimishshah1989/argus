import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import { aiConfigFromEnv, createFakeProvider, startAiJobs } from '../src/modules/ai/index.js';
import { DIAGNOSIS_PROMPT } from '../src/modules/ai/diagnosis.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '73000000-0000-4000-8000-00000000000a';
const id = (n: number): string =>
  `73000000-0000-4000-8000-0000000000${n.toString(16).padStart(2, '0')}`;
const MACHINES = Array.from({ length: 8 }, (_, i) => id(0x30 + i));
const PASSWORD = 'correct-horse-battery';

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let config: AppConfig;
let token: string;
let nextMachine = 0;
let keys = 0;

const post = (url: string, payload: unknown, key = `k-${(keys += 1)}`) =>
  app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    payload: payload as object,
  });

async function raise(extra: Record<string, unknown> = {}, key?: string) {
  const res = await post(
    '/api/v1/tickets',
    { machineId: MACHINES[nextMachine++]!, problem: 'Spindle alarm', ...extra },
    key,
  );
  expect(res.statusCode).toBe(201);
  return res.json().ticket.id as string;
}

const queued = async (ticketId: string) =>
  (
    await db.admin.query(
      `SELECT data FROM pgboss.job WHERE name = 'ai.suggest' AND data->>'subjectId' = $1`,
      [ticketId],
    )
  ).rows.map((row) => row.data);

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [A, 'cosmos']);
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [id(0x20), A],
  );
  await db.admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell)
     SELECT m, $2, 'DQ-' || n, $3, 'VMC', 'Cell-1' FROM unnest($1::uuid[]) WITH ORDINALITY AS u(m, n)`,
    [MACHINES, A, id(0x20)],
  );
  await db.admin.query('INSERT INTO person (id, tenant_id, name, active) VALUES ($1, $2, $3, true)', [
    id(0x10),
    A,
    'Opera Testperson',
  ]);
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.admin.query(
    `INSERT INTO login (tenant_id, person_id, username, password_hash, role)
     VALUES ($1, $2, 'opera', $3, 'operator')`,
    [A, id(0x10), passwordHash],
  );
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [A],
  );
  config = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username: 'opera', password: PASSWORD },
  });
  token = res.json().token as string;
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('a breakdown that is raised queues one diagnosis', () => {
  it('names the ticket and the prompt, and nothing a person could be named by', async () => {
    const ticketId = await raise();
    expect(await queued(ticketId)).toEqual([
      {
        v: 1,
        tenantId: A,
        feature: 'diagnosis',
        subjectType: 'ticket',
        subjectId: ticketId,
        promptVersion: DIAGNOSIS_PROMPT.version,
      },
    ]);
  });

  it('queues nothing for a support ticket, and nothing again when it is upgraded', async () => {
    const ticketId = await raise({ kind: 'support' });
    expect(await queued(ticketId)).toEqual([]);
    const upgraded = await post(`/api/v1/tickets/${ticketId}/upgrade-kind`, {});
    expect(upgraded.statusCode).toBe(200);
    expect(await queued(ticketId)).toEqual([]);
  });

  it('queues once when the same report is sent twice', async () => {
    const ticketId = await raise({}, 'same-report');
    const again = await post(
      '/api/v1/tickets',
      { machineId: MACHINES[nextMachine - 1]!, problem: 'Spindle alarm' },
      'same-report',
    );
    expect(again.json().ticket.id).toBe(ticketId);
    expect(await queued(ticketId)).toHaveLength(1);
  });
});

describe('from a report to a stored shadow diagnosis', () => {
  it('is stored and marked shadow, after one provider call', async () => {
    const ticketId = await raise();
    const fake = createFakeProvider();
    await startAiJobs(
      config.jobBoss!,
      { pool: db.app, config: aiConfigFromEnv({}), provider: fake },
      'all',
    );
    const row = await waitFor(async () => {
      const found = (
        await db.admin.query(
          'SELECT status, mode, prompt_version, output, attempts FROM ai_suggestion WHERE ticket_id = $1',
          [ticketId],
        )
      ).rows[0];
      return found?.status === 'ready' ? found : undefined;
    });
    expect(row).toMatchObject({
      mode: 'shadow',
      attempts: 1,
      prompt_version: DIAGNOSIS_PROMPT.version,
    });
    expect(row.output).toMatchObject({ v: 1, candidates: expect.any(Array) });
  }, 30_000);
});

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let i = 0; i < 40; i += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('timed out waiting for the diagnosis');
}
