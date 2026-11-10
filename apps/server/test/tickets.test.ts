import { readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const A = '10000000-0000-0000-0000-000000000001';
const PERSON = '10000000-0000-0000-0000-000000000041';
const LOGIN = '10000000-0000-0000-0000-000000000042';
const SEGMENT = '10000000-0000-0000-0000-000000000043';
const MACHINE = '10000000-0000-0000-0000-000000000044';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let app: App;

function req(method: 'GET' | 'POST', url: string, token?: string, payload?: object): Promise<Res> {
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  await pool.query(
    readFileSync(
      new URL('../../../packages/db/migrations/0001_schema_v1.sql', import.meta.url),
      'utf8',
    ),
  );
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [A]);
  await pool.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, A],
  );
  await pool.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, category) VALUES ($1, $2, 'VC-1', $3, 'VMC')",
    [MACHINE, A, SEGMENT],
  );
  await pool.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Asha', 'maintenance')",
    [PERSON, A],
  );
  await pool.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'asha', $4, 'operator', false)",
    [LOGIN, A, PERSON, passwordHash],
  );
  await pool.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [A],
  );
  app = await buildApp({ pool, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
});

describe('walking skeleton tickets', () => {
  it('raises a ticket and lists it in /state', async () => {
    const login = await req('POST', '/api/v1/auth/login', undefined, {
      username: 'asha',
      password: PASSWORD,
    });
    const token = login.json().token as string;
    const raised = await req('POST', '/api/v1/tickets', token, {
      machineId: MACHINE,
      problem: 'Spindle alarm',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ref).toBe('BD-0150');
    const state = await req('GET', '/api/v1/state', token);
    expect(state.json().open).toHaveLength(1);
    expect(state.json().open[0].problem).toBe('Spindle alarm');
  });

  it('rejects a duplicate raise on the same machine', async () => {
    const login = await req('POST', '/api/v1/auth/login', undefined, {
      username: 'asha',
      password: PASSWORD,
    });
    const token = login.json().token as string;
    const duplicate = await req('POST', '/api/v1/tickets', token, {
      machineId: MACHINE,
      problem: 'Again',
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('requires authentication', async () => {
    const raised = await req('POST', '/api/v1/tickets', undefined, {
      machineId: MACHINE,
      problem: 'X',
    });
    expect(raised.statusCode).toBe(401);
  });
});
