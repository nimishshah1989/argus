import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCEPTIONS, guardedStatements, scanMigrations } from './check-migrations.js';

function plant(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
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
