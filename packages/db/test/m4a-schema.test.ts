import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMigratedDb } from './migrated.js';

// What the M4a migration (0014) gives the analytics tickets, seen the way they will use it: through the app role, the
// plant's own rows, and the erasure function.
const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const TICKET_A = '10000000-0000-0000-0000-00000000000e';
const MACHINE_A = '10000000-0000-0000-0000-000000000008';
const HASH = 'a'.repeat(64);
const NAME_HASH = 'b'.repeat(64);

let container: StartedPostgreSqlContainer;
let db: Client;
let url: string;

const asPlant = (tenant: string) =>
  db.query("SELECT set_config('app.tenant_id', $1, false)", [tenant]);
const figure = (
  key: string,
  asOf: string,
  value: unknown,
  subject: [string, string] = ['plant', ''],
) =>
  db.query(
    `INSERT INTO kpi_snapshot (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of, run_id, value)
     VALUES (current_setting('app.tenant_id')::uuid, 'legacy', $1, $2, $3, '2026-11-01', '2026-11-30', $4, gen_random_uuid(), $5)
     ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
     DO UPDATE SET value = EXCLUDED.value, run_id = EXCLUDED.run_id`,
    [key, subject[0], subject[1], asOf, JSON.stringify(value)],
  );
const listItem = (list: string, code: string, aliases: string[] = []) =>
  db.query(
    "INSERT INTO list_item (tenant_id, list, code, label, aliases) VALUES (current_setting('app.tenant_id')::uuid, $1, $2, $2, $3)",
    [list, code, aliases],
  );
const resolve = async (list: string, legacy: string) =>
  (
    await db.query(
      'SELECT code FROM list_item WHERE list = $1 AND (lower(code) = lower($2) OR aliases @> ARRAY[lower($2)])',
      [list, legacy],
    )
  ).rows.map((row) => row.code as string);

beforeAll(async () => {
  ({ container, client: db, url } = await startMigratedDb());
  await db.query('SET ROLE app_user');
}, 120_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('stored figures', () => {
  it('replaces a re-run of the same figure on the same day and keeps a later day beside it', async () => {
    await asPlant(A);
    await figure('a3.mttr', '2026-11-20', { hours: 2 });
    await figure('a3.mttr', '2026-11-20', { hours: 3 });
    await figure('a3.mttr', '2026-11-21', { hours: 4 });
    const rows = await db.query(
      "SELECT as_of::text AS d, value FROM kpi_snapshot WHERE key = 'a3.mttr' AND as_of >= '2026-11-20' ORDER BY as_of",
    );
    expect(rows.rows).toEqual([
      { d: '2026-11-20', value: { hours: 3 } },
      { d: '2026-11-21', value: { hours: 4 } },
    ]);
  });

  it('keeps one plant out of another plant’s figures, for reading and for writing', async () => {
    await asPlant(B);
    await figure('b_only', '2026-11-20', { n: 1 });
    await asPlant(A);
    expect((await db.query("SELECT 1 FROM kpi_snapshot WHERE key = 'b_only'")).rowCount).toBe(0);
    await expect(
      db.query(
        `INSERT INTO kpi_snapshot (tenant_id, profile, key, subject_kind, period_start, period_end, as_of, run_id, value)
         VALUES ($1, 'legacy', 'x', 'plant', '2026-11-01', '2026-11-30', '2026-11-30', gen_random_uuid(), '1')`,
        [B],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('refuses a figure that names no subject, names one for the whole plant, or ends before it starts', async () => {
    await asPlant(A);
    await expect(figure('a3.mttr', '2026-11-22', 1, ['machine', ''])).rejects.toThrow(
      /subject_shape/,
    );
    await expect(figure('a3.mttr', '2026-11-22', 1, ['plant', 'VC-1'])).rejects.toThrow(
      /subject_shape/,
    );
    await expect(figure('a3.mttr', '2026-11-22', 1, ['person', 'someone'])).rejects.toThrow(
      /subject_kind_check/,
    );
    await expect(
      db.query(
        `INSERT INTO kpi_snapshot (tenant_id, profile, key, subject_kind, period_start, period_end, as_of, run_id, value)
         VALUES ($1, 'legacy', 'x', 'plant', '2026-11-30', '2026-11-01', '2026-11-30', gen_random_uuid(), '1')`,
        [A],
      ),
    ).rejects.toThrow(/period_order/);
  });

  it('holds a figure for a machine and one for a period that ends after the day it was computed', async () => {
    await asPlant(A);
    await figure('forecast.next_12m', '2026-11-14', { bands: [1, 2] }, ['machine', MACHINE_A]);
    await figure('a1-bd:pm', '2026-11-14', { pct: 4 });
    expect((await db.query("SELECT 1 FROM kpi_snapshot WHERE key = 'a1-bd:pm'")).rowCount).toBe(1);
    const found = await db.query('SELECT value FROM kpi_snapshot WHERE subject_key = $1', [
      MACHINE_A,
    ]);
    expect(found.rows[0].value).toEqual({ bands: [1, 2] });
  });
});

describe('legacy codes', () => {
  it('resolves a retired code through the entry it was folded into, in any letter case', async () => {
    await asPlant(A);
    await listItem('maint_code', 'E', ['ELE', ' Electrical ']);
    await listItem('maint_code', 'HY', ['HYD']);
    expect(await resolve('maint_code', 'ele')).toEqual(['E']);
    expect(await resolve('maint_code', 'ELECTRICAL')).toEqual(['E']);
    expect(await resolve('maint_code', 'HYD')).toEqual(['HY']);
    expect(await resolve('maint_code', 'hy')).toEqual(['HY']);
  });

  it('refuses a legacy code that two entries of one list both claim, or that is another entry’s own code', async () => {
    await asPlant(A);
    await expect(listItem('maint_code', 'EL2', ['ele'])).rejects.toThrow(
      /already used in this list/,
    );
    await expect(listItem('maint_code', 'MECH', ['hy'])).rejects.toThrow(
      /already used in this list/,
    );
    await expect(listItem('maint_code', 'hyd')).rejects.toThrow(/already used in this list/);
    await expect(listItem('maint_code', 'SELF', ['self'])).rejects.toThrow(
      /already used in this list/,
    );
    await expect(
      db.query(
        "UPDATE list_item SET aliases = ARRAY['HYD'] WHERE list = 'maint_code' AND code = 'E'",
      ),
    ).rejects.toThrow(/already used in this list/);
  });

  it('refuses a code another entry of the same list claims in any letter case, and lets another list or plant use it', async () => {
    await asPlant(A);
    await listItem('packet1_codes', 'MOTOR');
    await expect(listItem('packet1_codes', 'motor')).rejects.toThrow(/already used in this list/);
    await listItem('packet1_codes', 'PMP', ['pump']);
    await expect(listItem('packet1_codes', 'PUMP')).rejects.toThrow(/already used in this list/);
    await expect(listItem('packet1_codes', 'ZZ', ['pmp'])).rejects.toThrow(
      /already used in this list/,
    );
    await listItem('packet1_other', 'motor');
    await asPlant(B);
    await listItem('packet1_codes', 'motor');
  });

  it('lets another list, and another plant, use the same legacy code', async () => {
    await asPlant(A);
    await listItem('failure_code', 'ELEC', ['ELE']);
    await asPlant(B);
    await listItem('maint_code', 'E', ['ELE']);
    expect(await resolve('maint_code', 'ELE')).toEqual(['E']);
  });

  it('lets only one of two writers claim the same legacy code at the same moment', async () => {
    await asPlant(A);
    const other = new Client({ connectionString: url });
    await other.connect();
    try {
      await other.query('SET ROLE app_user');
      await other.query("SELECT set_config('app.tenant_id', $1, false)", [A]);
      await db.query('BEGIN');
      await listItem('maint_code', 'RACE1', ['rt']);
      await other.query('BEGIN');
      const second = other.query(
        "INSERT INTO list_item (tenant_id, list, code, label, aliases) VALUES ($1, 'maint_code', 'RACE2', 'RACE2', ARRAY['rt'])",
        [A],
      );
      second.catch(() => undefined);
      await new Promise((resolveWait) => setTimeout(resolveWait, 300));
      await db.query('COMMIT');
      await expect(second).rejects.toThrow(/already used in this list/);
      await other.query('ROLLBACK');
    } finally {
      await other.end();
    }
    expect(await resolve('maint_code', 'rt')).toEqual(['RACE1']);
  });
});

describe('the homes of the analytics face’s stored items', () => {
  it('keeps each saved Why-Why as a history line of its closed ticket, and cannot rewrite one', async () => {
    await asPlant(A);
    const why = (n: number, conclusion: string) =>
      db.query(
        `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, payload)
         VALUES ($1, $2, $3, 'why_why', $4)`,
        [A, TICKET_A, n, JSON.stringify({ whys: ['a', 'b', 'c'], conclusion })],
      );
    await why(2, 'first draft');
    await why(3, 'worn bearing');
    const latest = await db.query(
      "SELECT payload->>'conclusion' AS c FROM ticket_event WHERE ticket_id = $1 AND type = 'why_why' ORDER BY seq DESC",
      [TICKET_A],
    );
    expect(latest.rows.map((row) => row.c)).toEqual(['worn bearing', 'first draft']);
    await expect(
      db.query("UPDATE ticket_event SET payload = '{}' WHERE type = 'why_why'"),
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps a nudge’s snooze and a Team Focus action as separate rows that two heads cannot overwrite', async () => {
    await asPlant(A);
    const put = (key: string, value: unknown) =>
      db.query(
        `INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [A, key, JSON.stringify(value)],
      );
    await put('nudge:long|VC-1', { status: 'snoozed', until: '2026-11-21' });
    await put('nudge:freq|VC-2', { status: 'ack' });
    await put('focus:2026-11|a1', { status: 'doing', note: 'bearing ordered' });
    await put('nudge:long|VC-1', { status: 'done' });
    const rows = await db.query(
      "SELECT key, value FROM setting WHERE key ~ '^(nudge|focus):' ORDER BY key",
    );
    expect(rows.rows).toEqual([
      { key: 'focus:2026-11|a1', value: { status: 'doing', note: 'bearing ordered' } },
      { key: 'nudge:freq|VC-2', value: { status: 'ack' } },
      { key: 'nudge:long|VC-1', value: { status: 'done' } },
    ]);
  });

  it('keeps a breakdown’s spare cost and a move’s locations', async () => {
    await asPlant(A);
    await db.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, spare_cost)
       VALUES ($1, $2, $3, '2026-11-13', '1', 'Bearing noise', 1250.5)`,
      [A, TICKET_A, MACHINE_A],
    );
    await db.query(
      `INSERT INTO machine_move (tenant_id, machine_id, from_cell, to_cell, from_location, to_location, effective_from)
       VALUES ($1, $2, '4', '2', '434', '841-B', '2026-08-03')`,
      [A, MACHINE_A],
    );
    expect(
      (
        await db.query(
          "SELECT spare_cost::text AS c FROM breakdown_report WHERE problem = 'Bearing noise'",
        )
      ).rows[0].c,
    ).toBe('1250.50');
    expect(
      (await db.query("SELECT to_location FROM machine_move WHERE from_location = '434'")).rows[0]
        .to_location,
    ).toBe('841-B');
    await expect(
      db.query("UPDATE breakdown_report SET spare_cost = -1 WHERE problem = 'Bearing noise'"),
    ).rejects.toThrow(/spare_cost/);
  });
});

describe('erasing a leaver reaches the notes of their Team Focus actions and nudges', () => {
  it('replaces the name in those notes only, in that plant only, and leaves the rest of the row', async () => {
    await db.query('RESET ROLE');
    // No plant is set on this session: only the router role's own policy lets the scrub reach the setting rows.
    await db.query("SELECT set_config('app.tenant_id', '', false)");
    const person = (
      await db.query(
        "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Test Leaver', 'maintenance') RETURNING id",
        [A],
      )
    ).rows[0].id;
    const put = (tenant: string, key: string, value: unknown) =>
      db.query('INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)', [
        tenant,
        key,
        JSON.stringify(value),
      ]);
    await put(A, 'focus:2026-11|erase', {
      status: 'doing',
      ownerPersonId: person,
      note: 'Ask Test Leaver to check it',
    });
    await put(A, 'nudge:long|erase', { status: 'ack', note: 'test leaver is on it' });
    await put(A, 'company.note', { text: 'Test Leaver signs the plant rules' });
    await put(B, 'focus:2026-11|erase', { note: 'Ask Test Leaver to check it' });
    await put(A, 'focus:2026-11|other', { note: 'Order a bearing' });
    const stamp = async () =>
      (
        await db.query(
          "SELECT updated_at::text AS t FROM setting WHERE tenant_id = $1 AND key = 'focus:2026-11|other'",
          [A],
        )
      ).rows[0].t;
    const untouched = await stamp();

    await db.query('SELECT erase_person($1, $2, $3, $4, $5, $6)', [
      A,
      person,
      'request-1',
      'operator-1',
      HASH,
      NAME_HASH,
    ]);

    const value = async (tenant: string, key: string) =>
      (await db.query('SELECT value FROM setting WHERE tenant_id = $1 AND key = $2', [tenant, key]))
        .rows[0].value;
    expect(await value(A, 'focus:2026-11|erase')).toEqual({
      status: 'doing',
      ownerPersonId: person,
      note: 'Ask Former staff to check it',
    });
    expect(await value(A, 'nudge:long|erase')).toEqual({
      status: 'ack',
      note: 'Former staff is on it',
    });
    expect(await value(A, 'company.note')).toEqual({ text: 'Test Leaver signs the plant rules' });
    expect(await value(B, 'focus:2026-11|erase')).toEqual({ note: 'Ask Test Leaver to check it' });
    expect(await stamp()).toBe(untouched);
  });

  it('is not set off by a write of the erasure hash from the app’s own login', async () => {
    await db.query('RESET ROLE');
    await db.query("CREATE ROLE stray_app LOGIN PASSWORD 'stray-test-password' IN ROLE app_user");
    const person = (
      await db.query(
        "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Stray Leaver', 'maintenance') RETURNING id",
        [A],
      )
    ).rows[0].id;
    await db.query('INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)', [
      A,
      'focus:2026-11|stray',
      JSON.stringify({ note: 'Ask Stray Leaver' }),
    ]);
    const login = new URL(url);
    login.username = 'stray_app';
    login.password = 'stray-test-password';
    const stray = new Client({ connectionString: login.toString() });
    await stray.connect();
    try {
      await stray.query("SELECT set_config('app.tenant_id', $1, false)", [A]);
      await stray.query('UPDATE person SET erasure_hash = $1 WHERE id = $2', [HASH, person]);
    } finally {
      await stray.end();
    }
    const note = await db.query("SELECT value FROM setting WHERE key = 'focus:2026-11|stray'");
    expect(note.rows[0].value).toEqual({ note: 'Ask Stray Leaver' });
  });
});
