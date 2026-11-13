import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMigratedDb } from './migrated.js';

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const FUNCTIONS = [
  'import_undo(uuid,uuid,text)',
  'erase_person(uuid,uuid,text,text)',
  'offboard_tenant(uuid,text,text,text)',
  'audit_purge(timestamptz,text)',
  'erase_json_values(jsonb,text)',
];

let container: StartedPostgreSqlContainer;
let db: Client;
let url: string;

/** Runs `run` as the router role in one committed transaction. */
async function asRouter<T>(run: () => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE app_router');
    const result = await run();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

const erase = (tenantId: string, person: string, ref: string, operator = 'agent-test') =>
  asRouter(
    async () =>
      (
        await db.query('SELECT erase_person($1, $2, $3, $4) AS r', [
          tenantId,
          person,
          ref,
          operator,
        ])
      ).rows[0].r,
  );

async function tenant(id: string, slug: string, status = 'active'): Promise<void> {
  await db.query('INSERT INTO tenant (id, slug, name, status) VALUES ($1, $2, $3, $4)', [
    id,
    slug,
    slug,
    status,
  ]);
}

async function person(
  tenantId: string,
  name: string,
  extra: { short?: string; phone?: string } = {},
) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO person (id, tenant_id, name, short_name, phone) VALUES ($1, $2, $3, $4, $5)',
    [id, tenantId, name, extra.short ?? null, extra.phone ?? null],
  );
  return id;
}

async function ticket(
  tenantId: string,
  ref: string,
  problem: string,
  extra: Record<string, unknown> = {},
) {
  const id = randomUUID();
  const columns = { problem, ...extra };
  const names = Object.keys(columns);
  await db.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, reported_at, severity, ${names.join(', ')})
     VALUES ($1, $2, $3, 'general', 'open', now(), 'S3', ${names.map((_, i) => `$${i + 4}`).join(', ')})`,
    [id, tenantId, ref, ...Object.values(columns)],
  );
  return id;
}

/** Text columns and JSON string values of one tenant that still match a pattern. */
async function hits(tenantId: string, pattern: string): Promise<string[]> {
  const columns = await db.query(
    `SELECT c.table_name AS t, c.column_name AS col, c.data_type AS type
     FROM information_schema.columns c JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'jsonb')
       AND EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema = 'public'
         AND x.table_name = c.table_name AND x.column_name = 'tenant_id')`,
  );
  const found: string[] = [];
  for (const { t, col, type } of columns.rows) {
    const sql =
      type === 'jsonb'
        ? `SELECT count(*)::int AS n FROM ${t}, jsonb_path_query(${col}, 'strict $.**') v
           WHERE tenant_id = $1 AND jsonb_typeof(v) = 'string' AND (v #>> '{}') ~* $2`
        : `SELECT count(*)::int AS n FROM ${t} WHERE tenant_id = $1 AND ${col} ~* $2`;
    if ((await db.query(sql, [tenantId, pattern])).rows[0].n > 0) found.push(`${t}.${col}`);
  }
  return found.sort();
}

async function count(table: string, tenantId: string): Promise<number> {
  return (
    await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`, [tenantId])
  ).rows[0].n;
}

beforeAll(async () => {
  ({ container, client: db, url } = await startMigratedDb());
}, 120_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('who may call the definer functions', () => {
  it('lets only the router role call the five functions', async () => {
    for (const fn of FUNCTIONS) {
      const result = await db.query(
        `SELECT has_function_privilege('app_api', $1, 'EXECUTE') AS api,
                has_function_privilege('app_user', $1, 'EXECUTE') AS app,
                has_function_privilege('app_router', $1, 'EXECUTE') AS router`,
        [fn],
      );
      expect(result.rows[0], fn).toEqual({ api: false, app: false, router: true });
    }
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE app_api');
      await expect(
        db.query('SELECT import_undo($1, $2, $3)', [A, randomUUID(), 'agent-test']),
      ).rejects.toThrow(/permission denied for function/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('the app login is not a member of the router role', async () => {
    const member = await db.query(
      "SELECT pg_has_role('app_api', 'app_router', 'USAGE') AS usage, pg_has_role('app_api', 'app_router', 'MEMBER') AS member",
    );
    expect(member.rows[0]).toEqual({ usage: false, member: false });
  });

  it('import_undo refuses a blank operator', async () => {
    await expect(
      asRouter(() => db.query('SELECT import_undo($1, $2, $3)', [A, randomUUID(), ' '])),
    ).rejects.toThrow(/operator is required/);
  });
});

let imports = 0;

/** A finished import batch of tenant `tenantId` with `n` imported tickets; its fingerprint names them. */
async function importedBatch(tenantId: string, n = 1) {
  imports += 1;
  const batch = randomUUID();
  const tickets: string[] = [];
  for (let i = 0; i < n; i++) {
    tickets.push(
      await ticket(tenantId, `IM-${imports}-${i}`, 'imported', { raised_channel: 'import' }),
    );
  }
  await db.query(
    `INSERT INTO import_batch (id, tenant_id, source, status, finished_at, stats)
     VALUES ($1, $2, 'bhavin', 'done', now() - interval '1 hour', $3)`,
    [
      batch,
      tenantId,
      JSON.stringify({ completion: { tickets: tickets.map((t) => ({ ticketId: t })) } }),
    ],
  );
  for (const [i, t] of tickets.entries()) {
    await db.query(
      `INSERT INTO import_row (tenant_id, batch_id, row_number, status, ticket_id)
       VALUES ($1, $2, $3, 'imported', $4)`,
      [tenantId, batch, i + 1, t],
    );
  }
  return { batch, tickets, first: tickets[0] ?? '' };
}

const undo = (tenantId: string, batch: string) =>
  asRouter(
    async () =>
      (await db.query('SELECT import_undo($1, $2, $3) AS n', [tenantId, batch, 'agent-test']))
        .rows[0].n as number,
  );

describe('import_undo', () => {
  it('removes the batch tickets and marks the batch undone', async () => {
    const { batch, tickets } = await importedBatch(A, 2);
    expect(await undo(A, batch)).toBe(2);
    expect((await db.query('SELECT 1 FROM ticket WHERE id = ANY($1)', [tickets])).rows).toEqual([]);
    expect(
      (await db.query('SELECT status FROM import_batch WHERE id = $1', [batch])).rows[0].status,
    ).toBe('undone');
  });

  it("refuses another customer's batch", async () => {
    const { batch, tickets } = await importedBatch(A);
    await expect(undo(B, batch)).rejects.toThrow(/does not belong to this customer/);
    expect(
      (await db.query('SELECT 1 FROM ticket WHERE id = ANY($1)', [tickets])).rows,
    ).toHaveLength(1);
  });

  it('waits for a writer on an imported ticket and then refuses, never deleting the new row', async () => {
    const { batch, tickets } = await importedBatch(A);
    const writer = new Client({ connectionString: url });
    await writer.connect();
    try {
      await writer.query('BEGIN');
      await writer.query(
        `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, text)
         VALUES ($1, $2, 1, 'note', 'late note')`,
        [A, tickets[0]],
      );
      let settled = false;
      const attempt = undo(A, batch).then(
        () => 'undone',
        (error: Error) => error.message,
      );
      void attempt.then(() => (settled = true));
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(settled).toBe(false);
      await writer.query('COMMIT');
      expect(await attempt).toMatch(/worked on after the import finished/);
    } finally {
      await writer.end();
    }
    const note = await db.query(
      "SELECT 1 FROM ticket_event WHERE ticket_id = $1 AND text = 'late note'",
      [tickets[0]],
    );
    expect(note.rows).toHaveLength(1);
    expect((await db.query('SELECT 1 FROM ticket WHERE id = $1', [tickets[0]])).rows).toHaveLength(
      1,
    );
  });

  it('refuses when an AI suggestion on a batch ticket was decided or made after the import', async () => {
    const insert = (ticketId: string, extra: string, values: unknown[] = []) =>
      db.query(
        `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
           prompt_version, model_ref, status, outcome, output, decision, decided_at, created_at)
         VALUES ($1, 'triage', 'ticket', $2::text, $2::uuid, 'v1', 'm', 'ready', 'ok', '{}', ${extra})`,
        [A, ticketId, ...values],
      );
    const decided = await importedBatch(A);
    await insert(
      decided.first,
      "'accepted', now() - interval '30 minutes', now() - interval '2 hours'",
    );
    await expect(undo(A, decided.batch)).rejects.toThrow(/AI suggestion/);

    const fresh = await importedBatch(A);
    await insert(fresh.first, 'NULL, NULL, now()');
    await expect(undo(A, fresh.batch)).rejects.toThrow(/AI suggestion/);
    expect((await db.query('SELECT 1 FROM ticket WHERE id = $1', [fresh.first])).rows).toHaveLength(
      1,
    );

    const old = await importedBatch(A);
    await insert(old.first, "NULL, NULL, now() - interval '2 hours'");
    expect(await undo(A, old.batch)).toBe(1);
  });
});

describe('erase_person', () => {
  it("leaves the leaver's name in no DATA-MAP §5 place and writes one count-only audit row", async () => {
    const T = '40000000-0000-0000-0000-000000000001';
    await tenant(T, 'erasure');
    const leaver = await person(T, 'Testa Leaver', { short: 'Testa', phone: '+910000000099' });
    const own = randomUUID();
    const shared = randomUUID();
    await db.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
       ($1, $3, $4, 'testa.l', 'hash', 'technician', false),
       ($2, $3, NULL, 'floor-1', 'hash', 'operator', true)`,
      [own, shared, T, leaver],
    );
    for (const [login, token] of [
      [own, 't-own'],
      [shared, 't-shared'],
    ] as const) {
      await db.query(
        `INSERT INTO session (tenant_id, login_id, token_hash, expires_at, acting_person_id)
         VALUES ($1, $2, $3, now() + interval '1 day', $4)`,
        [T, login, token, leaver],
      );
      await db.query(
        'INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint) VALUES ($1, $2, $3, $4)',
        [T, login, leaver, `https://push.example/${token}`],
      );
    }
    const machine = randomUUID();
    await db.query("INSERT INTO machine (id, tenant_id, code) VALUES ($1, $2, 'M-9')", [
      machine,
      T,
    ]);
    const t1 = await ticket(T, 'BD-0001', 'Testa Leaver fixed the press', {
      location: 'Bay by Testa',
      close_note: 'call +910000000099',
      waiting_spare: 'spare for Testa Leaver',
      task_reason: 'Testa asked',
      overrides: '{"note":"Testa Leaver","Testa":1}',
      reported_by_person_id: leaver,
      machine_id: machine,
    });
    const t2 = await ticket(T, 'WR-0001', 'Testabhai came by');
    await db.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, text, payload, login_id, acting_person_id)
       VALUES ($1, $2, 1, 'note', 'Testa Leaver paused it', '{"by":"Testa Leaver","count":3}', $3, $4)`,
      [T, t1, own, leaver],
    );
    await db.query(
      "INSERT INTO crew_member (tenant_id, ticket_id, person_id, role) VALUES ($1, $2, $3, 'primary')",
      [T, t1, leaver],
    );
    await db.query(
      "INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at) VALUES ($1, $2, $3, 'lead', now())",
      [T, t1, leaver],
    );
    const [signature, pdf] = [randomUUID(), randomUUID()];
    await db.query(
      `INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256) VALUES
       ($1, $3, 'signature', 'erasure/sig.png', 'image/png', 1, 's1'),
       ($2, $3, 'pdf', 'erasure/report.pdf', 'application/pdf', 1, 's2')`,
      [signature, pdf, T],
    );
    await db.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem,
         observed_by, corrective_action, spare_used, root_cause, handover_name, signature_file_id,
         pdf_file_id, qr_payload)
       VALUES ($1, $2, $3, current_date, '1', 'Testa Leaver saw smoke', 'Testa', 'by Testa Leaver',
         'part +910000000099', 'Testa Leaver mistake', 'Testa Leaver', $4, $5, '{"who":"Testa"}')`,
      [T, t1, machine, signature, pdf],
    );
    const batch = randomUUID();
    const completion = '{"tickets":[],"digest":"d1"}';
    await db.query(
      `INSERT INTO import_batch (id, tenant_id, source, status, stats) VALUES ($1, $2, 'bhavin', 'done',
         jsonb_build_object('pendingPersons', jsonb_build_array('Testa Leaver'), 'completion', $3::jsonb))`,
      [batch, T, completion],
    );
    await db.query(
      `INSERT INTO import_row (tenant_id, batch_id, row_number, status, payload)
       VALUES ($1, $2, 1, 'skipped', '{"name":"Testa Leaver"}')`,
      [T, batch],
    );
    await db.query(
      `INSERT INTO audit_log (tenant_id, action, entity, entity_id, before, after) VALUES
       ($1, 'person.update', 'person', $2, '{"name":"Testa Leaver"}', '{"name":"Testa"}'),
       ($1, 'setting.update', 'setting', NULL, NULL, '{"note":"by Testa Leaver"}')`,
      [T, leaver],
    );
    await db.query(
      `INSERT INTO audit_log (tenant_id, login_id, action, entity, ip) VALUES
       ($1, $2, 'ticket.start', 'ticket', '203.0.113.7'), ($1, $3, 'ticket.start', 'ticket', '203.0.113.8')`,
      [T, own, shared],
    );
    await db.query(
      `INSERT INTO command_idempotency (tenant_id, login_id, key, command, request_hash, result)
       VALUES ($1, $2, 'k1', 'raise', 'h', '{"message":"Testa Leaver raised it"}')`,
      [T, shared],
    );
    const pattern = '\\mTesta\\M|0000000099';
    expect((await hits(T, pattern)).length).toBeGreaterThan(10); // the fixture is not vacuous
    const before = await db.query(
      `SELECT (SELECT count(*) FROM ticket_event WHERE tenant_id = $1) AS events,
              (SELECT count(*) FROM crew_member WHERE tenant_id = $1) AS crew,
              (SELECT count(*) FROM work_segment WHERE tenant_id = $1) AS stretches,
              (SELECT stats -> 'completion' FROM import_batch WHERE id = $2)::text AS completion`,
      [T, batch],
    );

    const result = await erase(T, leaver, 'REQ-1');

    expect(await hits(T, pattern)).toEqual([]);
    const after = await db.query(
      `SELECT (SELECT count(*) FROM ticket_event WHERE tenant_id = $1) AS events,
              (SELECT count(*) FROM crew_member WHERE tenant_id = $1) AS crew,
              (SELECT count(*) FROM work_segment WHERE tenant_id = $1) AS stretches,
              (SELECT stats -> 'completion' FROM import_batch WHERE id = $2)::text AS completion`,
      [T, batch],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect((await db.query('SELECT problem FROM ticket WHERE id = $1', [t2])).rows[0].problem).toBe(
      'Testabhai came by',
    );
    const overrides = await db.query(
      "SELECT overrides ->> 'Testa' AS kept, overrides ->> 'note' AS note FROM ticket WHERE id = $1",
      [t1],
    );
    expect(overrides.rows[0]).toEqual({ kept: '1', note: 'Former staff' });
    const gone = await db.query('SELECT name, phone, active FROM person WHERE id = $1', [leaver]);
    expect(gone.rows[0]).toEqual({ name: 'Former staff', phone: null, active: false });
    const login = await db.query(
      'SELECT username, password_hash, disabled_at FROM login WHERE id = $1',
      [own],
    );
    expect(login.rows[0]).toMatchObject({ username: `former-${own}`, password_hash: '!' });
    expect(login.rows[0].disabled_at).not.toBeNull();
    expect(await count('push_subscription', T)).toBe(1);
    const sessions = await db.query(
      'SELECT login_id, acting_person_id FROM session WHERE tenant_id = $1',
      [T],
    );
    expect(sessions.rows).toEqual([{ login_id: shared, acting_person_id: null }]);
    expect((await db.query('SELECT id FROM file WHERE tenant_id = $1', [T])).rows).toEqual([]);
    expect([...result.s3_keys].sort()).toEqual(['erasure/report.pdf', 'erasure/sig.png']);
    const asha = await db.query(
      "SELECT name FROM person WHERE id = '10000000-0000-0000-0000-000000000002'",
    );
    expect(asha.rows[0].name).toBe('Asha');

    const audit = await db.query(
      "SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase'",
      [T],
    );
    expect(audit.rows).toHaveLength(1);
    const row = audit.rows[0].after;
    expect(Object.keys(row).sort()).toEqual(
      [
        'audit_log',
        'audit_log_ip',
        'audit_log_own',
        'breakdown_report',
        'command_idempotency',
        'file',
        'import_batch',
        'import_row',
        'login',
        'operator',
        'push_subscription',
        'push_subscription_unlinked',
        'request_ref',
        'session',
        'session_unlinked',
        'skipped_short_terms',
        'text_searched',
        'ticket',
        'ticket_event',
      ].sort(),
    );
    expect(row).toMatchObject({
      text_searched: true,
      request_ref: 'REQ-1',
      operator: 'agent-test',
    });
    expect(JSON.stringify(row)).not.toMatch(/Testa/);
    expect(row.audit_log_ip).toBe(1);
    const ips = await db.query(
      "SELECT login_id, ip FROM audit_log WHERE tenant_id = $1 AND action = 'ticket.start' ORDER BY ip NULLS FIRST",
      [T],
    );
    expect(ips.rows).toEqual([
      { login_id: own, ip: null },
      { login_id: shared, ip: '203.0.113.8' },
    ]);
  });

  it('refuses a person of another customer', async () => {
    const T = '40000000-0000-0000-0000-000000000005';
    await tenant(T, 'wrong-tenant');
    const leaver = await person(T, 'Testa Leaver');
    await expect(erase(B, leaver, 'REQ-5')).rejects.toThrow(/does not belong to this customer/);
    expect((await db.query('SELECT name FROM person WHERE id = $1', [leaver])).rows[0].name).toBe(
      'Testa Leaver',
    );
  });

  it('refuses without a reference or operator, or with the name in the reference', async () => {
    const T = '40000000-0000-0000-0000-000000000002';
    await tenant(T, 'refusals');
    const leaver = await person(T, 'Testa Leaver', { short: 'Testa' });
    await expect(erase(T, leaver, ' ')).rejects.toThrow(/required/);
    await expect(erase(T, leaver, 'REQ-2', ' ')).rejects.toThrow(/required/);
    await expect(erase(T, leaver, 'REQ for Testa Leaver')).rejects.toThrow(
      /must not hold the name/,
    );
    const row = await db.query('SELECT name, active FROM person WHERE id = $1', [leaver]);
    expect(row.rows[0]).toEqual({ name: 'Testa Leaver', active: true });
  });

  it('replaces a Gujarati name only as a whole word', async () => {
    const T = '40000000-0000-0000-0000-000000000003';
    await tenant(T, 'gujarati');
    const leaver = await person(T, 'ટેસ્ટા');
    const first = await ticket(T, 'WR-0001', 'ટેસ્ટા (ફિટર) આવ્યા');
    const second = await ticket(T, 'WR-0002', 'ટેસ્ટાભાઈ આવ્યા');
    await erase(T, leaver, 'REQ-3');
    const rows = await db.query('SELECT id, problem FROM ticket WHERE tenant_id = $1', [T]);
    const problem = (id: string) => rows.rows.find((r) => r.id === id).problem;
    expect(problem(first)).toBe('Former staff (ફિટર) આવ્યા');
    expect(problem(second)).toBe('ટેસ્ટાભાઈ આવ્યા');
  });

  it('with no searchable term switches the person off and searches no text', async () => {
    const T = '40000000-0000-0000-0000-000000000004';
    await tenant(T, 'short-name');
    const leaver = await person(T, 'Om');
    const id = await ticket(T, 'WR-0001', 'Om checked');
    const before = await db.query(
      'SELECT problem, updated_at::text AS u FROM ticket WHERE id = $1',
      [id],
    );
    await erase(T, leaver, 'REQ-4');
    expect(
      (await db.query('SELECT problem, updated_at::text AS u FROM ticket WHERE id = $1', [id]))
        .rows,
    ).toEqual(before.rows);
    const row = await db.query('SELECT name, active FROM person WHERE id = $1', [leaver]);
    expect(row.rows[0]).toEqual({ name: 'Former staff', active: false });
    const audit = await db.query(
      "SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase'",
      [T],
    );
    expect(audit.rows[0].after).toMatchObject({ text_searched: false, skipped_short_terms: 1 });
  });
});

describe('offboard_tenant and audit_purge', () => {
  const offboard = (id: string, exportRef: string, backupRef: string, operator: string) =>
    asRouter(() =>
      db.query('SELECT offboard_tenant($1, $2, $3, $4)', [id, exportRef, backupRef, operator]),
    );

  async function fill(T: string): Promise<void> {
    const p = await person(T, 'Leaving Person');
    const login = randomUUID();
    await db.query(
      "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'leaving-user', 'h', 'technician', false)",
      [login, T, p],
    );
    const machine = randomUUID();
    await db.query("INSERT INTO machine (id, tenant_id, code) VALUES ($1, $2, 'M-1')", [
      machine,
      T,
    ]);
    const t = await ticket(T, 'BD-0001', 'x', {
      reported_by_person_id: p,
      raised_login_id: login,
      machine_id: machine,
    });
    await db.query(
      "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, login_id) VALUES ($1, $2, 1, 'down', $3)",
      [T, t, login],
    );
  }

  it('offboard_tenant refuses without both references and an operator, or while the customer is active', async () => {
    const T = '50000000-0000-0000-0000-000000000002';
    await tenant(T, 'staying');
    await fill(T);
    await expect(offboard(T, ' ', 'BAK-1', 'agent-test')).rejects.toThrow(/required/);
    await expect(offboard(T, 'EXP-1', ' ', 'agent-test')).rejects.toThrow(/required/);
    await expect(offboard(T, 'EXP-1', 'BAK-1', ' ')).rejects.toThrow(/required/);
    await expect(offboard(T, 'EXP-1', 'BAK-1', 'agent-test')).rejects.toThrow(/not suspended/);
    for (const table of ['person', 'login', 'machine', 'ticket', 'ticket_event'])
      expect(await count(table, T), table).toBe(1);
  });

  it("offboard_tenant removes a suspended customer's rows and keeps the proof", async () => {
    const T = '50000000-0000-0000-0000-000000000001';
    await tenant(T, 'leaving', 'suspended');
    await fill(T);
    await offboard(T, 'EXP-1', 'BAK-1', 'agent-test');

    const tables = await db.query(
      `SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
         AND a.attname = 'tenant_id' AND NOT a.attisdropped ORDER BY 1`,
    );
    for (const { relname } of tables.rows)
      expect(await count(relname, T), relname).toBe(relname === 'audit_log' ? 1 : 0);
    const proof = await db.query('SELECT action, after FROM audit_log WHERE tenant_id = $1', [T]);
    expect(proof.rows).toEqual([
      {
        action: 'tenant.offboard',
        after: { export_ref: 'EXP-1', backup_ref: 'BAK-1', operator: 'agent-test' },
      },
    ]);
    const row = await db.query('SELECT status, slug FROM tenant WHERE id = $1', [T]);
    expect(row.rows[0]).toEqual({ status: 'offboarded', slug: `offboarded-${T}` });
    await expect(offboard(T, 'EXP-1', 'BAK-1', 'agent-test')).rejects.toThrow(/not suspended/);
    await tenant(randomUUID(), 'leaving');
  });

  it('the app role cannot delete a customer', async () => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE app_api');
      await expect(db.query('DELETE FROM tenant WHERE id = $1', [A])).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('audit_purge removes rows over 3 years old and leaves one count row per customer', async () => {
    const old = (tenantId: string, action: string) =>
      db.query(
        "INSERT INTO audit_log (tenant_id, action, entity, at) VALUES ($1, $2, 'setting', now() - interval '4 years')",
        [tenantId, action],
      );
    await old(A, 'old.one');
    await old(A, 'old.two');
    await old(B, 'old.three');
    await expect(
      asRouter(() => db.query("SELECT audit_purge(now() - interval '1 year', 'agent-test')")),
    ).rejects.toThrow(/at least 3 years/);
    await expect(
      asRouter(() => db.query("SELECT audit_purge(now() - interval '3 years 1 day', ' ')")),
    ).rejects.toThrow(/operator is required/);
    const purged = await asRouter(
      async () =>
        (await db.query("SELECT audit_purge(now() - interval '3 years 1 day', 'agent-test') AS n"))
          .rows[0].n,
    );
    expect(Number(purged)).toBe(3);
    expect((await db.query("SELECT 1 FROM audit_log WHERE action LIKE 'old.%'")).rows).toEqual([]);
    expect(await count('audit_log', A)).toBeGreaterThan(1); // recent rows remain
    const notes = await db.query(
      "SELECT tenant_id, after ->> 'deleted' AS deleted FROM audit_log WHERE action = 'audit.purge' ORDER BY deleted DESC",
    );
    expect(notes.rows).toEqual([
      { tenant_id: A, deleted: '2' },
      { tenant_id: B, deleted: '1' },
    ]);
  });
});
