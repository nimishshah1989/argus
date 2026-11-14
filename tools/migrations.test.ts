import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCEPTIONS, guardedStatements, scanMigrations } from './check-migrations.js';

function plant(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const APPROVED = '-- approved-by: agent-reviewer\n-- backup: s3://uptimo-backups/pre-0008\n';
const DROP = 'ALTER TABLE ticket DROP COLUMN urgent;\n';
const finding = (n: number): string =>
  `migrations: 0008_planted.sql:${n}: DROP needs '-- approved-by:' and '-- backup:' in the file header`;

describe('migration guard', () => {
  it('catches each guarded statement anywhere in a statement', () => {
    const cases: [string, string][] = [
      ['ALTER TABLE ticket DROP COLUMN urgent;', 'DROP'],
      ['ALTER TABLE x DROP CONSTRAINT x_key;', 'DROP'],
      ["  UPDATE ticket SET severity = 'S4';", 'UPDATE'],
      ['ALTER TABLE ticket ALTER COLUMN severity SET NOT NULL;', 'SET NOT NULL'],
      ['ALTER TABLE ticket ALTER COLUMN note TYPE text;', 'ALTER TYPE'],
      ['REVOKE DELETE ON ticket FROM app_user;', 'REVOKE'],
      ['TRUNCATE ticket;', 'TRUNCATE'],
      ["DELETE FROM ticket WHERE id = 'x';", 'DELETE FROM'],
    ];
    for (const [sql, rule] of cases)
      expect(guardedStatements(`-- header\n${sql}`), sql).toEqual([{ rule, line: 2 }]);
    expect(scanMigrations(plant({ '0008_planted.sql': DROP }))).toEqual([finding(1)]);
  });

  it('passes an approved header and fails a half or misplaced one', () => {
    expect(scanMigrations(plant({ '0008_planted.sql': APPROVED + DROP }))).toEqual([]);
    const bad = [
      '-- approved-by: agent-reviewer\n' + DROP,
      '-- backup: s3://x\n' + DROP,
      '-- approved-by:\n-- backup: s3://x\n' + DROP,
      '-- approved-by: agent-reviewer\n-- backup:\n' + DROP,
      DROP + APPROVED,
    ];
    for (const sql of bad) {
      const n = sql.split('\n').findIndex((l) => l.startsWith('ALTER')) + 1;
      expect(scanMigrations(plant({ '0008_planted.sql': sql })), sql).toEqual([finding(n)]);
    }
  });

  it('leaves benign grants, column defaults and comments alone', () => {
    const sql = [
      'CREATE TABLE t (updated_at timestamptz NOT NULL DEFAULT now(), ref uuid',
      '  REFERENCES ticket(id) ON DELETE SET NULL ON UPDATE CASCADE);',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON t TO app_user;',
      'CREATE TRIGGER x BEFORE INSERT OR UPDATE OF ref ON t FOR EACH ROW EXECUTE FUNCTION f();',
      '-- we will drop t later',
    ].join('\n');
    expect(guardedStatements(sql)).toEqual([]);
  });

  it('skips the seven dated exceptions by name and passes the merged migrations', () => {
    expect(EXCEPTIONS.map((e) => e.file)).toEqual([
      '0001_schema_v1.sql',
      '0002_app_api_role.sql',
      '0003_command_idempotency_binding.sql',
      '0004_cancel_time.sql',
      '0005_ticket_tag.sql',
      '0006_severity_matrix.sql',
      '0007_sla_policy_timer.sql',
    ]);
    for (const e of EXCEPTIONS) {
      expect(e.merged).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.reason).not.toBe('');
    }
    expect(scanMigrations()).toEqual([]);
    const drop = 'DROP TABLE ticket_tag;\n';
    expect(scanMigrations(plant({ '0005_ticket_tag.sql': drop }))).toEqual([]);
    expect(scanMigrations(plant({ '0008_planted.sql': drop }))).toHaveLength(1);
  });
});

describe('revert files', () => {
  const down = (n: number): string =>
    `migrations: down/0008_planted.down.sql:${n}: DROP needs '-- backup:' in the file header`;

  it('need a backup line before a guarded statement, and no approver line', () => {
    expect(scanMigrations(plant({ 'down/0008_planted.down.sql': DROP }))).toEqual([down(1)]);
    expect(
      scanMigrations(plant({ 'down/0008_planted.down.sql': '-- backup: snapshot first\n' + DROP })),
    ).toEqual([]);
    for (const sql of ['-- backup:\n' + DROP, DROP + '-- backup: late\n']) {
      const n = sql.split('\n').findIndex((l) => l.startsWith('ALTER')) + 1;
      expect(scanMigrations(plant({ 'down/0008_planted.down.sql': sql })), sql).toEqual([down(n)]);
    }
  });

  it('are checked next to the migrations they undo', () => {
    const files = { '0008_planted.sql': APPROVED + DROP, 'down/0008_planted.down.sql': DROP };
    expect(scanMigrations(plant(files))).toEqual([down(1)]);
  });
});

describe('migration guard scanner', () => {
  const rules = (sql: string) => guardedStatements(sql);

  it('catches statements hidden by block comments', () => {
    expect(rules("UPDATE ticket/**/SET severity = 'S4';")).toEqual([{ rule: 'UPDATE', line: 1 }]);
    expect(rules('DELETE/**/FROM ticket;')).toEqual([{ rule: 'DELETE FROM', line: 1 }]);
    expect(rules('/* one\ntwo */ DROP TABLE x;')).toEqual([{ rule: 'DROP', line: 2 }]);
  });

  it('does not let -- inside a string hide the rest of the line', () => {
    expect(rules("SELECT '--'; DROP TABLE ticket;")).toEqual([{ rule: 'DROP', line: 1 }]);
    expect(rules("-- don't\nDROP TABLE x;")).toEqual([{ rule: 'DROP', line: 2 }]);
  });

  it('catches UPDATE ONLY t * SET', () => {
    expect(rules("UPDATE ONLY ticket * SET severity = 'S4';")).toEqual([
      { rule: 'UPDATE', line: 1 },
    ]);
  });

  it('leaves comments and strings that only mention a keyword alone', () => {
    expect(rules('/* drop later */')).toEqual([]);
    expect(rules("SELECT 'a -- b';")).toEqual([]);
  });

  it('does not let a dollar quote or an escaped quote hide a statement', () => {
    const drop = [{ rule: 'DROP', line: 2 }];
    expect(rules('SELECT $$--$$;\nDROP TABLE ticket;')).toEqual(drop);
    expect(rules('SELECT $x$/*$x$;\nDROP TABLE ticket;')).toEqual(drop);
    expect(rules("SELECT E'\\' -- ';\nDROP TABLE ticket;")).toEqual(drop);
    expect(rules("SELECT E'it''s \\\\';\nDROP TABLE ticket;")).toEqual(drop);
    expect(rules('SELECT $x$/*$x$;\nDROP TABLE ticket;\nDELETE FROM audit_log;')).toEqual([
      { rule: 'DROP', line: 2 },
      { rule: 'DELETE FROM', line: 3 },
    ]);
    // A body is scanned as it is: a comment in it can cost a false positive, never a hidden statement.
    expect(rules('DO $$ BEGIN\n-- drop later\nEND $$;')).toEqual(drop);
  });

  it('reads quoted identifiers', () => {
    expect(rules('UPDATE "my table" SET a = 1;')).toEqual([{ rule: 'UPDATE', line: 1 }]);
    expect(rules('UPDATE public."my ""t""" AS x SET a = 1;')).toEqual([
      { rule: 'UPDATE', line: 1 },
    ]);
    expect(rules('ALTER TABLE t ALTER COLUMN "my col" TYPE text;')).toEqual([
      { rule: 'ALTER TYPE', line: 1 },
    ]);
    expect(rules('ALTER TABLE t ALTER COLUMN "my col" SET DATA TYPE text;')).toEqual([
      { rule: 'ALTER TYPE', line: 1 },
    ]);
  });

  it('counts dynamic SQL, and only dynamic SQL, as guarded', () => {
    expect(rules("DO $$ BEGIN\n  EXECUTE 'DR' || 'OP TABLE ticket';\nEND $$;")).toEqual([
      { rule: 'EXECUTE', line: 2 },
    ]);
    expect(rules("DO $$ BEGIN EXECUTE format('ALTER TABLE %I', 'x'); END $$;")).toEqual([
      { rule: 'EXECUTE', line: 1 },
    ]);
    const benign = [
      'CREATE TRIGGER x BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f();',
      'CREATE TRIGGER x BEFORE INSERT ON t FOR EACH ROW EXECUTE PROCEDURE f();',
      'GRANT EXECUTE ON FUNCTION f() TO app_user;',
      "SELECT has_function_privilege('app_api', 'f()', 'EXECUTE');",
    ];
    for (const sql of benign) expect(rules(sql), sql).toEqual([]);
  });

  it('does not let non-ASCII names, quoted aliases or unicode-escaped names hide a statement', () => {
    const drop = [{ rule: 'DROP', line: 1 }];
    const update = [{ rule: 'UPDATE', line: 1 }];
    // A non-ASCII letter before $$ is part of a name, so the $$ does not open a quote.
    expect(rules('SELECT 1 AS é$$, $$ -- $$; DROP TABLE ticket;')).toEqual(drop);
    expect(rules("DO $$ BEGIN EXECUTE'DR'||'OP TABLE ticket'; END $$;")).toEqual([
      { rule: 'EXECUTE', line: 1 },
    ]);
    expect(rules('UPDATE ticket "x" SET a = 1;')).toEqual(update);
    expect(rules('UPDATE ticket AS "my x" SET a = 1;')).toEqual(update);
    expect(rules('UPDATE ticket é SET a = 1;')).toEqual(update);
    expect(rules('UPDATE é SET a = 1;')).toEqual(update);
    expect(rules('UPDATE U&"\\0074icket" SET a = 1;')).toEqual(update);
    expect(rules('UPDATE u&"\\0074icket" AS x SET a = 1;')).toEqual(update);
    expect(rules('ALTER TABLE t ALTER COLUMN U&"c\\0301" TYPE text;')).toEqual([
      { rule: 'ALTER TYPE', line: 1 },
    ]);
  });

  it('reports a dollar quote it cannot pair instead of trusting the rest of the file', () => {
    expect(rules('SELECT 1;\nSELECT $x$ never closed;\nSELECT 2;')).toEqual([
      { rule: 'UNPAIRED $', line: 2 },
    ]);
    expect(rules('SELECT $x$ closed $x$;')).toEqual([]);
  });

  it('flags the planted bypass files', () => {
    const planted = [
      'SELECT $$--$$; DROP TABLE ticket;',
      'SELECT $x$/*$x$;\nDROP TABLE ticket;\nDELETE FROM audit_log;',
      "SELECT E'\\' -- '; DROP TABLE ticket;",
      'UPDATE "my table" SET a = 1;',
      "DO $$ BEGIN EXECUTE 'DR' || 'OP TABLE ticket'; END $$;",
      'SELECT 1 AS é$$, $$ -- $$; DROP TABLE ticket;',
      "DO $$ BEGIN EXECUTE'DR'||'OP TABLE ticket'; END $$;",
      'UPDATE ticket "x" SET a = 1;',
      'UPDATE ticket é SET a = 1;',
      'UPDATE U&"\\0074icket" SET a = 1;',
      'SELECT $x$ never closed;',
    ];
    for (const sql of planted)
      expect(scanMigrations(plant({ '0008_planted.sql': sql })).length, sql).toBeGreaterThan(0);
    expect(scanMigrations(plant({ '0008_planted.sql': APPROVED + planted[0] }))).toEqual([]);
  });
});
