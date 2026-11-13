import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY, boundaryErrors, sqlLiterals, tablesNamed } from './check-boundaries.js';

const SRC = 'apps/server/src';

function plant(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'boundaries-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('boundaries check', () => {
  it('passes the server tree', () => {
    expect(boundaryErrors(process.cwd())).toEqual([]);
  });

  it('keeps the LEGACY baseline at the 9-file snapshot, so it can only shrink', () => {
    expect(Object.keys(LEGACY).sort()).toEqual(
      [
        'day-report.ts',
        'import/references.ts',
        'reports.ts',
        'tag-sql.ts',
        'ticket-report.ts',
        'ticket-sql.ts',
        'ticket/severity.ts',
        'ticket/sla.ts',
        'tickets.ts',
      ].map((file) => `${SRC}/${file}`),
    );
  });

  it.each([
    [
      `${SRC}/modules/plant/routes.ts`,
      "client.query('SELECT id FROM machine WHERE id = $1', [id]);",
      `${SRC}/modules/plant/routes.ts: SQL names machine (owned by plant); only ${SRC}/modules/plant/repo.ts may`,
    ],
    [
      `${SRC}/new-file.ts`,
      'client.query(`select * from audit_log where id = ${id}`);',
      `${SRC}/new-file.ts: SQL names audit_log (owned by ops); only ${SRC}/modules/ops/repo.ts may`,
    ],
    [
      `${SRC}/modules/plant/repo.ts`,
      '"SELECT name FROM person"',
      `${SRC}/modules/plant/repo.ts: SQL names person (owned by identity); only ${SRC}/modules/identity/repo.ts may`,
    ],
  ])('fails a planted SQL call outside the owner repo.ts: %s', (path, text, error) => {
    expect(boundaryErrors(plant({ [path]: text }), {})).toEqual([error]);
  });

  it("passes SQL inside the owner's repo.ts", () => {
    const root = plant({
      [`${SRC}/modules/plant/repo.ts`]:
        "q('SELECT id FROM machine'); q('INSERT INTO list_item (code) VALUES ($1)');",
      [`${SRC}/modules/identity/repo.ts`]: "q('SELECT * FROM auth_lookup($1)');",
      [`${SRC}/modules/ops/repo.ts`]: "q('INSERT INTO audit_log (action) VALUES ($1)');",
    });
    expect(boundaryErrors(root, {})).toEqual([]);
  });

  it("allows the owner's repo/ folder", () => {
    const sql = "q('SELECT 1 FROM machine');";
    expect(boundaryErrors(plant({ [`${SRC}/modules/plant/repo/x.ts`]: sql }), {})).toEqual([]);
    expect(boundaryErrors(plant({ [`${SRC}/modules/tickets/repo/x.ts`]: sql }), {})).toEqual([
      `${SRC}/modules/tickets/repo/x.ts: SQL names machine (owned by plant); only ${SRC}/modules/plant/repo.ts may`,
    ]);
  });

  it('ignores comments, unowned tables and test files', () => {
    const root = plant({
      [`${SRC}/a.ts`]: "// read from person\nconst fromPerson = 1;\nq('SELECT * FROM ticket');",
      [`${SRC}/a.test.ts`]: "q('SELECT * FROM person');",
    });
    expect(boundaryErrors(root, {})).toEqual([]);
  });

  it('passes a baselined file for its tables and fails for a new one', () => {
    const root = plant({
      [`${SRC}/push.ts`]: "q('SELECT 1 FROM person'); q('UPDATE machine SET code = $1');",
    });
    expect(boundaryErrors(root, { [`${SRC}/push.ts`]: ['person'] })).toEqual([
      `${SRC}/push.ts: SQL names machine (owned by plant); only ${SRC}/modules/plant/repo.ts may`,
    ]);
  });

  it('reads every literal kind', () => {
    const source =
      'a(\'FROM login\'); b("JOIN session s"); c(`UPDATE setting SET v = ${v} FROM shift`);';
    expect(sqlLiterals(source).flatMap(tablesNamed)).toEqual([
      'login',
      'session',
      'setting',
      'shift',
    ]);
  });

  it('fails a stale baseline entry', () => {
    const root = plant({ [`${SRC}/push.ts`]: "q('SELECT 1 FROM person');" });
    expect(boundaryErrors(root, { [`${SRC}/push.ts`]: ['person', 'machine'] })).toEqual([
      `${SRC}/push.ts: LEGACY lists machine but the file no longer names it; remove it`,
    ]);
  });
});
