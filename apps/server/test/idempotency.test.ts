import { readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const M3 = '10000000-0000-0000-0000-000000000005';
const M4 = '10000000-0000-0000-0000-000000000006';
const M5 = '10000000-0000-0000-0000-000000000007';
const ASHA = '10000000-0000-0000-0000-000000000008';
const BINA = '10000000-0000-0000-0000-000000000009';
const LOGIN_ASHA = '10000000-0000-0000-0000-00000000000a';
const LOGIN_BINA = '10000000-0000-0000-0000-00000000000b';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let app: App;
let ashaToken = '';
let binaToken = '';

function post(url: string, token: string, payload: unknown, key: string): Promise<Res> {
  return app.inject({
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
}

async function login(username: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  for (const file of ['0001_schema_v1.sql', '0003_command_idempotency_binding.sql']) {
    await pool.query(
      readFileSync(new URL(`../../../packages/db/migrations/${file}`, import.meta.url), 'utf8'),
    );
  }
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [TENANT]);
  await pool.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  await pool.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
     ($1, $6, 'VC-1', $7, 'VMC', 'Cell-1'),
     ($2, $6, 'VC-2', $7, 'VMC', 'Cell-1'),
     ($3, $6, 'VC-3', $7, 'HMC', 'Cell-2'),
     ($4, $6, 'VC-4', $7, 'VMC', 'Cell-2'),
     ($5, $6, 'VC-5', $7, 'HMC', 'Cell-3')`,
    [M1, M2, M3, M4, M5, TENANT, SEGMENT],
  );
  await pool.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $3, 'Asha', 'maintenance', 'Technician'),
     ($2, $3, 'Bina', 'maintenance', 'Technician')`,
    [ASHA, BINA, TENANT],
  );
  await pool.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $4, 'asha', $6, 'technician', false),
     ($2, $3, $5, 'bina', $6, 'technician', false)`,
    [LOGIN_ASHA, LOGIN_BINA, TENANT, ASHA, BINA, passwordHash],
  );
  await pool.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );

  app = await buildApp({ pool, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  binaToken = await login('bina');
}, 120_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
});

describe('idempotency binding', () => {
  it('replays the same key with the same body', async () => {
    const payload = { machineId: M1, problem: 'Spindle' };
    const first = await post('/api/v1/tickets', ashaToken, payload, 'replay-same');
    expect(first.statusCode).toBe(201);
    const replay = await post('/api/v1/tickets', ashaToken, payload, 'replay-same');
    expect(replay.statusCode).toBe(201);
    expect(replay.json().ticket.ref).toBe(first.json().ticket.ref);
  });

  it('rejects the same key with a different body (422)', async () => {
    const first = await post(
      '/api/v1/tickets',
      ashaToken,
      { machineId: M2, problem: 'A' },
      'reuse',
    );
    expect(first.statusCode).toBe(201);
    const reused = await post(
      '/api/v1/tickets',
      ashaToken,
      { machineId: M2, problem: 'B' },
      'reuse',
    );
    expect(reused.statusCode).toBe(422);
    expect(reused.json().error.field).toBe('idempotencyKey');
  });

  it('treats the same key from another login as a new command', async () => {
    const a = await post(
      '/api/v1/tickets',
      ashaToken,
      { machineId: M3, problem: 'A' },
      'other-login',
    );
    expect(a.statusCode).toBe(201);
    const b = await post(
      '/api/v1/tickets',
      binaToken,
      { machineId: M4, problem: 'A' },
      'other-login',
    );
    expect(b.statusCode).toBe(201);
    expect(a.json().ticket.ref).not.toBe(b.json().ticket.ref);
  });

  it('ignores an expired (>24h) key and re-executes', async () => {
    const payload = { machineId: M5, problem: 'Expired' };
    const first = await post('/api/v1/tickets', ashaToken, payload, 'expired');
    expect(first.statusCode).toBe(201);
    await pool.query(
      "UPDATE command_idempotency SET created_at = now() - interval '25 hours' WHERE key = $1",
      ['expired'],
    );
    // The stored row is ignored, so the raise re-executes and hits the duplicate-machine 409.
    const replay = await post('/api/v1/tickets', ashaToken, payload, 'expired');
    expect(replay.statusCode).toBe(409);
  });
});
