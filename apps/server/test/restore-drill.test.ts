import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareCounts,
  formatReport,
  realRestoreErrors,
  runRestoreDrill,
} from '../../../scripts/restore-drill.js';
import { startTestDb, type TestDb } from './harness.js';

let db: TestDb;
const A = 'f1000000-0000-0000-0000-000000000001';

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'alpha', 'alpha')", [A]);
  for (let n = 1; n <= 5; n++) {
    const id = randomUUID();
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, $3, 'stopped', 'open', 'x', now(), 'S3')`,
      [id, A, `BD-000${n}`],
    );
    for (let seq = 1; seq <= n; seq++)
      await db.admin.query(
        "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, $3, 'down')",
        [A, id, seq],
      );
  }
  await db.admin.query("INSERT INTO person (tenant_id, name) VALUES ($1, 'Someone')", [A]);
}, 180_000);

afterAll(async () => {
  await db.stop();
});

const databases = async () =>
  (await db.admin.query('SELECT datname FROM pg_database')).rows.map((r) => r.datname as string);

describe('restore drill (Drill B)', () => {
  it('restores a dump into an empty database, finds equal counts on the ten largest tables, and cleans up', async () => {
    const before = await databases();
    const result = await runRestoreDrill(db.container.getConnectionUri());
    expect(result.stopped).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]).toMatchObject({ table: 'ticket_event', rows: 15, restored: 15 });
    expect(result.rows.find((r) => r.table === 'ticket')).toMatchObject({ rows: 5, restored: 5 });
    expect(result.rows.every((r) => r.equal)).toBe(true);
    expect(formatReport(result)).toMatch(
      /RESTORE DRILL PASS: 10 of 10 largest tables have equal row counts/,
    );
    expect(await databases()).toEqual(before);
  }, 120_000);

  it('stops, without dumping, when the login is subject to row security: its dump would be empty', async () => {
    const before = await databases();
    const result = await runRestoreDrill(db.app.options.connectionString as string);
    expect(result.ok).toBe(false);
    expect(result.stopped).toMatch(/row security/);
    expect(formatReport(result)).toMatch(/^RESTORE DRILL STOP: .*Nothing was compared\.$/);
    expect(await databases()).toEqual(before);
  });

  it('fails when a restored table has fewer rows or is missing, and says which', () => {
    const rows = compareCounts(
      [
        { table: 'ticket_event', rows: 15 },
        { table: 'ticket', rows: 5 },
        { table: 'person', rows: 1 },
      ],
      new Map([
        ['ticket_event', 15],
        ['ticket', 4],
      ]),
    );
    expect(rows.map((r) => r.equal)).toEqual([true, false, false]);
    const report = formatReport({ ok: false, dumpBytes: 10, rows });
    expect(report).toContain('FAIL  ticket: 5 rows in the source, 4 rows restored');
    expect(report).toContain('FAIL  person: 1 rows in the source, table missing');
    expect(report).toContain('RESTORE DRILL FAIL: 2 of 3 largest tables differ');
  });

  it('ignores "already exists" notes from pg_restore but not a real error', () => {
    const notes =
      'pg_restore: error: could not execute query: ERROR:  schema "public" already exists\n' +
      'pg_restore: warning: errors ignored on restore: 1';
    expect(realRestoreErrors(notes)).toEqual([]);
    expect(realRestoreErrors(`${notes}\npg_restore: error: relation "ticket" is broken`)).toEqual([
      'pg_restore: error: relation "ticket" is broken',
    ]);
  });
});
