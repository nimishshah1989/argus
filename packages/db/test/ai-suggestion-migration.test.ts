import { readFileSync, readdirSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { endPool } from './end-pool.js';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const A = '60000000-0000-0000-0000-00000000000a';
const B = '60000000-0000-0000-0000-00000000000b';
const TICKET_A = '60000000-0000-0000-0000-0000000000a1';
const TICKET_A2 = '60000000-0000-0000-0000-0000000000a2';
const TICKET_B = '60000000-0000-0000-0000-0000000000b1';
const PERSON = '60000000-0000-0000-0000-0000000000c1';
const LOGIN = '60000000-0000-0000-0000-0000000000d1';

let container: StartedPostgreSqlContainer;
let pool: Pool;

function sql(name: string, folder = ''): string {
  return readFileSync(new URL(`${folder}${name}`, MIGRATIONS), 'utf8');
}

async function rowCounts(): Promise<Record<string, number>> {
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables.rows) {
    const result = await pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`);
    counts[tablename] = result.rows[0].n;
  }
  return counts;
}

interface RowValues {
  tenant: string;
  ticket: string | null;
  subjectType: string;
  subjectId: string;
  promptVersion: string;
  status: string;
  outcome: string | null;
  mode: string;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

function valid(over: Partial<RowValues> = {}): RowValues {
  return {
    tenant: A,
    ticket: TICKET_A,
    subjectType: 'ticket',
    subjectId: TICKET_A,
    promptVersion: 'v1',
    status: 'failed',
    outcome: 'provider_error',
    mode: 'shadow',
    attempts: 1,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    ...over,
  };
}

async function insert(v: RowValues): Promise<void> {
  await pool.query(
    `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
       prompt_version, model_ref, mode, status, outcome, attempts, input_tokens, output_tokens,
       cost_micro_usd)
     VALUES ($1, 'diagnosis', $2, $3, $4, $5, 'fake', $6, $7, $8, $9, $10, $11, $12)`,
    [
      v.tenant,
      v.subjectType,
      v.subjectId,
      v.ticket,
      v.promptVersion,
      v.mode,
      v.status,
      v.outcome,
      v.attempts,
      v.inputTokens,
      v.outputTokens,
      v.cost,
    ],
  );
}

async function sqlState(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 2 });
  const before = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && name < '0008')
    .sort();
  for (const name of before) await pool.query(sql(name));
  await pool.query(
    `INSERT INTO tenant (id, slug, name) VALUES ($1, 'ai-a', 'AI Plant A'), ($2, 'ai-b', 'AI Plant B')`,
    [A, B],
  );
  await pool.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES
       ($1, $4, 'BD-1', 'stopped', 'open', 'Pump leaks', now(), 'S3'),
       ($2, $4, 'BD-2', 'stopped', 'open', 'Belt slips', now(), 'S3'),
       ($3, $5, 'BD-1', 'stopped', 'open', 'Fan noise', now(), 'S3')`,
    [TICKET_A, TICKET_A2, TICKET_B, A, B],
  );
}, 120_000);

afterAll(async () => {
  await endPool(pool);
  await container.stop();
});

it('0008 applies, reverts and applies again', async () => {
  const counts = await rowCounts();
  await pool.query(sql('0008_ai_suggestion.sql'));
  const table = await pool.query(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.ai_suggestion'::regclass`,
  );
  expect(table.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

  await pool.query(sql('0008_ai_suggestion.down.sql', 'down/'));
  expect(
    (await pool.query("SELECT to_regclass('public.ai_suggestion') AS t")).rows[0].t,
  ).toBeNull();
  expect(await rowCounts()).toEqual(counts);

  await pool.query(sql('0008_ai_suggestion.sql'));
  expect(
    (await pool.query("SELECT to_regclass('public.ai_suggestion') AS t")).rows[0].t,
  ).not.toBeNull();
});

it('allows one row per tenant, subject, feature and prompt version', async () => {
  await insert(valid());
  expect(await sqlState(insert(valid()))).toBe('23505');
  await insert(valid({ promptVersion: 'v2' }));
  await insert(valid({ tenant: B, ticket: TICKET_B, subjectId: TICKET_B }));
});

it('rejects out-of-range attempts, negative tokens or cost, and unknown status, mode or outcome', async () => {
  const bad: Partial<RowValues>[] = [
    { attempts: 5 },
    { inputTokens: -1 },
    { outputTokens: -1 },
    { cost: -1 },
    { status: 'done' },
    { mode: 'on' },
    { outcome: 'feature_off' },
  ];
  for (const [index, over] of bad.entries()) {
    const state = await sqlState(insert(valid({ promptVersion: `bad-${index}`, ...over })));
    expect(state, JSON.stringify(over)).toBe('23514');
  }
});

it('ties a ticket subject to a ticket of the same tenant', async () => {
  const nullTicket = valid({ promptVersion: 'tie-1', ticket: null });
  expect(await sqlState(insert(nullTicket))).toBe('23514');
  const otherId = valid({ promptVersion: 'tie-2', subjectId: TICKET_A2 });
  expect(await sqlState(insert(otherId))).toBe('23514');
  const crossTenant = valid({ promptVersion: 'tie-3', ticket: TICKET_B, subjectId: TICKET_B });
  expect(await sqlState(insert(crossTenant))).toBe('23503');
});

it('keeps the row and its tenant when the deciding person is deleted', async () => {
  await pool.query(`INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Ravi Fake')`, [
    PERSON,
    A,
  ]);
  await pool.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role)
     VALUES ($1, $2, $3, 'ravi.f', 'hash', 'admin')`,
    [LOGIN, A, PERSON],
  );
  await pool.query(
    `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
       prompt_version, model_ref, status, outcome, output, attempts, decision,
       decided_by_person_id, decided_by_login_id, decided_at)
     VALUES ($1, 'diagnosis', 'ticket', $2::text, $2::uuid, 'decided', 'fake', 'ready', 'ok', '{}', 1,
       'accepted', $3, $4, now())`,
    [A, TICKET_A2, PERSON, LOGIN],
  );
  await pool.query('DELETE FROM person WHERE id = $1', [PERSON]);
  const row = await pool.query(
    `SELECT tenant_id, decided_by_person_id, decided_by_login_id FROM ai_suggestion
     WHERE prompt_version = 'decided'`,
  );
  expect(row.rows).toEqual([
    { tenant_id: A, decided_by_person_id: null, decided_by_login_id: LOGIN },
  ]);
});

it('indexes the monthly cost sum', async () => {
  const indexes = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ai_suggestion'`,
  );
  const defs = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef as string]));
  expect(defs.get('ai_suggestion_month_idx')).toContain('(tenant_id, created_at)');
  expect(defs.get('ai_suggestion_key')).toContain('UNIQUE');
  expect(defs.get('ai_suggestion_key')).toContain(
    '(tenant_id, subject_type, subject_id, feature, prompt_version)',
  );
});
