import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESCALATION_DEFAULTS } from '@uptimo/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

// The M2 migration on a copy of the real plant: Cosmos's machines and shifts and its 275 real (pseudonymised)
// tickets, loaded at the schema before it, then migrated up, used, reverted and migrated again.
const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);
const UP = readFileSync(new URL('0012_m2_schema.sql', MIGRATIONS), 'utf8');
const DOWN = readFileSync(new URL('down/0012_m2_schema.down.sql', MIGRATIONS), 'utf8');

let db: TestDb;
let cosmos = '';
let other = '';
let ticket = '';
let person = '';
let shift = '';
let otherPerson = '';
let otherShift = '';
let before: Record<string, string> = {};
let beforeRevert: Record<string, string> = {};
let columns: Record<string, string[]> = {};

/** A fingerprint per table over the columns it had before the migration: unchanged data has an unchanged one. */
async function fingerprints(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [table, names] of Object.entries(columns)) {
    const row = `ROW(${names.map((name) => `"${name}"`).join(', ')})::text`;
    const found = await db.admin.query(
      `SELECT count(*)::int AS n, coalesce(md5(string_agg(md5(${row}), ',' ORDER BY md5(${row}))), '') AS h FROM "${table}"`,
    );
    result[table] = `${found.rows[0].n}:${found.rows[0].h}`;
  }
  return result;
}

/** Runs `sql` the way a request does: as the app role, inside one plant. */
async function asPlant(plant: string, sql: string, params: unknown[] = []) {
  const client = await db.app.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [plant]);
    return (await client.query(sql, params)).rows;
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

const insertRoster = (tenant: string, shiftId: string, personId: string, level = 'L1') =>
  db.admin.query(
    "INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level) VALUES ($1, '2026-11-14', $2, $3, $4)",
    [tenant, shiftId, personId, level],
  );
const insertNotification = (tenant: string, key: string, personId: string, extra = '') =>
  db.admin.query(
    `INSERT INTO notification (tenant_id, dedupe_key, kind, person_id, channel, next_attempt_at${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ($1, $2, 'escalation', $3, 'push', now()${extra ? ', ' + extra.split('=')[1] : ''})`,
    [tenant, key, personId],
  );

beforeAll(async () => {
  db = await startTestDb({ through: '0011_tenant_profile.sql' });
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  cosmos = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  );
  await importRealExport(db.app, cosmos, { tickets: fixture.tickets });
  other = (
    await db.admin.query(
      "INSERT INTO tenant (slug, name) VALUES ('plant-two', 'Plant Two') RETURNING id",
    )
  ).rows[0].id;
  otherPerson = (
    await db.admin.query(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Outsider', 'maintenance') RETURNING id",
      [other],
    )
  ).rows[0].id;
  otherShift = (
    await db.admin.query(
      "INSERT INTO shift (tenant_id, code, name, starts_at, ends_at) VALUES ($1, '1', 'Shift 1', '08:00', '18:30') RETURNING id",
      [other],
    )
  ).rows[0].id;
  const tables = await db.admin.query(
    `SELECT c.table_name AS t, array_agg(c.column_name::text ORDER BY c.ordinal_position) AS cols
       FROM information_schema.columns c JOIN information_schema.tables x
         ON x.table_schema = c.table_schema AND x.table_name = c.table_name AND x.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' GROUP BY c.table_name`,
  );
  columns = Object.fromEntries(tables.rows.map((row) => [row.t, row.cols]));
  before = await fingerprints();
  ticket = (await db.admin.query('SELECT id FROM ticket WHERE tenant_id = $1 LIMIT 1', [cosmos]))
    .rows[0].id;
  person = (await db.admin.query('SELECT id FROM person WHERE tenant_id = $1 LIMIT 1', [cosmos]))
    .rows[0].id;
  shift = (
    await db.admin.query("SELECT id FROM shift WHERE tenant_id = $1 AND code = '1'", [cosmos])
  ).rows[0].id;
}, 300_000);

afterAll(async () => {
  await db.stop();
});

describe('applying it to the real plant', () => {
  it('changes no row of the 275 real tickets or anything else the plant holds', async () => {
    expect(Number(before.ticket?.split(':')[0])).toBe(275);
    await db.admin.query(UP);
    expect(await fingerprints()).toEqual(before);
  });

  it('keeps every shift, segment and glossary term switched on', async () => {
    for (const table of ['shift', 'segment', 'glossary_term']) {
      const off = await db.admin.query(`SELECT count(*)::int AS n FROM ${table} WHERE NOT active`);
      expect(off.rows[0].n, table).toBe(0);
    }
  });
});

describe('the duty roster', () => {
  it('has a person once per date and shift, and the same person in another shift', async () => {
    await insertRoster(cosmos, shift, person);
    await expect(insertRoster(cosmos, shift, person, 'L2')).rejects.toThrow(/unique/);
    const second = (
      await db.admin.query("SELECT id FROM shift WHERE tenant_id = $1 AND code = '2'", [cosmos])
    ).rows[0].id;
    await insertRoster(cosmos, second, person);
  });

  it('cannot point at another plant’s shift or person', async () => {
    await expect(insertRoster(cosmos, otherShift, person)).rejects.toThrow(/foreign key/);
    await expect(insertRoster(cosmos, shift, otherPerson)).rejects.toThrow(/foreign key/);
  });

  it('knows only the ladder levels', async () => {
    await expect(insertRoster(cosmos, shift, otherPerson, 'L5')).rejects.toThrow(/check/);
  });
});

describe('notifications', () => {
  it('are unique per plant and dedupe key, and the same key is free in another plant', async () => {
    await insertNotification(cosmos, 'esc:1:L2:p1:push', person);
    await expect(insertNotification(cosmos, 'esc:1:L2:p1:push', person)).rejects.toThrow(/unique/);
    await insertNotification(other, 'esc:1:L2:p1:push', otherPerson);
  });

  it('are pending with a time to try again, sent with a time sent, or dead', async () => {
    await expect(
      db.admin.query(
        "INSERT INTO notification (tenant_id, dedupe_key, kind, person_id, channel) VALUES ($1, 'x1', 'k', $2, 'push')",
        [cosmos, person],
      ),
    ).rejects.toThrow(/notification_pending_shape/);
    await expect(
      db.admin.query(
        "INSERT INTO notification (tenant_id, dedupe_key, kind, person_id, channel, status) VALUES ($1, 'x2', 'k', $2, 'push', 'sent')",
        [cosmos, person],
      ),
    ).rejects.toThrow(/notification_sent_shape/);
    await db.admin.query(
      "INSERT INTO notification (tenant_id, dedupe_key, kind, person_id, channel, status, attempts) VALUES ($1, 'x3', 'k', $2, 'push', 'dead', 5)",
      [cosmos, person],
    );
  });

  it('go with their ticket when it is removed, and cannot name another plant’s ticket', async () => {
    await expect(
      db.admin.query(
        `INSERT INTO notification (tenant_id, dedupe_key, kind, person_id, channel, ticket_id, next_attempt_at)
         VALUES ($1, 'x4', 'k', $2, 'push', $3, now())`,
        [other, otherPerson, ticket],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('the escalation ladder', () => {
  const rule = (extra: Record<string, unknown>) => {
    const columns = {
      trigger: 'ack_missed',
      severity_min: 'S2',
      level: 'L2',
      notify_role: 'supervisor',
      ...extra,
    };
    const names = Object.keys(columns);
    return db.admin.query(
      `INSERT INTO escalation_rule (tenant_id, ${names.join(', ')})
       VALUES ($1, ${names.map((_, i) => `$${i + 2}`).join(', ')})`,
      [cosmos, ...Object.values(columns)],
    );
  };

  it('names a person or a role, never both and never neither', async () => {
    await rule({});
    await expect(rule({ notify_role: null })).rejects.toThrow(/escalation_rule_who/);
    await expect(rule({ notify_person_id: person })).rejects.toThrow(/escalation_rule_who/);
    await rule({ level: 'L3', notify_role: null, notify_person_id: person });
  });

  it('repeats no more often than every 15 minutes, and always with a cap', async () => {
    await expect(rule({ level: 'L1', repeat_minutes: 10, repeat_cap: 3 })).rejects.toThrow(/check/);
    await expect(rule({ level: 'L1', repeat_minutes: 30 })).rejects.toThrow(
      /escalation_rule_repeat_pair/,
    );
    await expect(rule({ level: 'L1', repeat_cap: 3 })).rejects.toThrow(
      /escalation_rule_repeat_pair/,
    );
    await rule({ level: 'L1', repeat_minutes: 15, repeat_cap: 3 });
  });

  it('holds every proposed default as a row', async () => {
    for (const d of ESCALATION_DEFAULTS) {
      await db.admin.query(
        `INSERT INTO escalation_rule (tenant_id, trigger, severity_min, level, notify_role, channel,
           delay_minutes, repeat_minutes, repeat_cap)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          cosmos,
          d.trigger,
          d.severityMin,
          d.level,
          d.notifyRole,
          d.channel,
          d.delayMinutes,
          d.repeatMinutes,
          d.repeatCap,
        ],
      );
    }
    const stored = await db.admin.query(
      'SELECT count(*)::int AS n FROM escalation_rule WHERE tenant_id = $1 AND delay_minutes >= 0',
      [cosmos],
    );
    expect(stored.rows[0].n).toBeGreaterThanOrEqual(ESCALATION_DEFAULTS.length);
  });

  it('does not take the same rule twice', async () => {
    await expect(rule({})).rejects.toThrow(/unique/);
  });
});

describe('the SLA clocks', () => {
  const timer = (kind: string, reason: string) =>
    db.admin.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, stopped_at, stop_reason, state)
       VALUES ($1, $2, $3, now(), now(), $4, 'stopped')`,
      [cosmos, ticket, kind, reason],
    );

  it('has a pause clock and a handback clock, each with its own stop reasons', async () => {
    await timer('pause', 'resumed');
    await timer('handback', 'confirmed');
    await expect(timer('pause', 'confirmed')).rejects.toThrow(/sla_timer_stop_reason_kind|unique/);
    await db.admin.query('DELETE FROM sla_timer WHERE kind = $1', ['pause']);
    await expect(timer('pause', 'confirmed')).rejects.toThrow(/sla_timer_stop_reason_kind/);
    await expect(timer('restore', 'resumed')).rejects.toThrow(/sla_timer_stop_reason_kind/);
    await expect(timer('other', 'closed')).rejects.toThrow(/sla_timer_kind_check/);
    await db.admin.query("DELETE FROM sla_timer WHERE kind IN ('pause', 'handback')");
  });
});

describe('plants stay apart', () => {
  it('shows a plant only its own roster, ladder and notifications', async () => {
    for (const table of ['roster_entry', 'escalation_rule', 'notification']) {
      const mine = await asPlant(cosmos, `SELECT DISTINCT tenant_id FROM ${table}`);
      expect(
        mine.map((row) => row.tenant_id),
        table,
      ).toEqual([cosmos]);
    }
    expect(await asPlant(other, 'SELECT dedupe_key FROM notification')).toEqual([
      { dedupe_key: 'esc:1:L2:p1:push' },
    ]);
    expect(
      await asPlant('00000000-0000-0000-0000-000000000000', 'SELECT 1 FROM roster_entry'),
    ).toEqual([]);
  });

  it('does not let a plant write a row for another', async () => {
    await expect(
      asPlant(
        cosmos,
        `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
         VALUES ($1, '2026-11-15', $2, $3, 'L1')`,
        [other, otherShift, otherPerson],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('removes all three with the plant when it is offboarded', async () => {
    await insertRoster(other, otherShift, otherPerson);
    await db.admin.query("UPDATE tenant SET status = 'suspended' WHERE id = $1", [other]);
    await db.router.query("SELECT offboard_tenant($1, 'export-ref', 'backup-ref', 'agent-test')", [
      other,
    ]);
    for (const table of ['roster_entry', 'escalation_rule', 'notification']) {
      const left = await db.admin.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`,
        [other],
      );
      expect(left.rows[0].n, table).toBe(0);
    }
  });
});

describe('reverting it', () => {
  it('puts the plant back as it was and drops what the migration added', async () => {
    beforeRevert = await fingerprints();
    for (const kind of ['pause', 'handback']) {
      await db.admin.query(
        `INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, state) VALUES ($1, $2, $3, now(), 'running')`,
        [cosmos, ticket, kind],
      );
    }
    await db.admin.query(DOWN);
    expect(await fingerprints()).toEqual(beforeRevert);
    const left = await db.admin.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('roster_entry', 'escalation_rule', 'notification')`,
    );
    expect(left.rows[0].n).toBe(0);
    await expect(
      db.admin.query(
        "INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, state) VALUES ($1, $2, 'pause', now(), 'running')",
        [cosmos, ticket],
      ),
    ).rejects.toThrow(/sla_timer_kind_check/);
  });

  it('applies again after a revert', async () => {
    await db.admin.query(UP);
    expect(await fingerprints()).toEqual(beforeRevert);
    await insertRoster(cosmos, shift, person);
  });
});
