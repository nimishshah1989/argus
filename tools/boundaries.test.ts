import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCEPTIONS } from '../apps/server/src/modules/manifest.js';
import {
  LEGACY,
  boundaryErrors,
  importErrors,
  sqlLiterals,
  tablesNamed,
} from './check-boundaries.js';

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

  it('keeps the LEGACY baseline empty, so no file may break the rule', () => {
    expect(Object.keys(LEGACY)).toEqual([]);
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

  it.each([
    'SELECT 1 FROM widget w, person p',
    'SELECT 1 FROM public.person',
    'SELECT 1 FROM "person"',
    'SELECT 1 FROM ONLY person',
    'SELECT 1 FROM widget w JOIN LATERAL person p ON true',
    'SELECT 1 FROM widget w, LATERAL (SELECT 1) x, "public"."person" y',
  ])('names a table in every FROM form: %s', (sql) => {
    const file = `${SRC}/modules/reports/x.ts`;
    expect(boundaryErrors(plant({ [file]: `q('${sql}');` }), {})).toEqual([
      `${file}: SQL names person (owned by identity); only ${SRC}/modules/identity/repo.ts may`,
    ]);
  });

  it('fails a non-index import of another module', () => {
    const file = `${SRC}/modules/reports/a.ts`;
    const error = `${file}: imports ${SRC}/modules/plant/repo.ts; plant is reached only through ${SRC}/modules/plant/index.ts`;
    for (const text of [
      "import { x } from '../plant/repo.js';",
      "import type { X } from '../plant/repo.js';",
    ])
      expect(importErrors(plant({ [file]: text }), [])).toEqual([error]);
  });

  it('fails a kernel-internal import', () => {
    const file = `${SRC}/modules/plant/a.ts`;
    const root = plant({ [file]: "import { g } from '../../kernel/guard.js';" });
    expect(importErrors(root, [])).toEqual([
      `${file}: imports ${SRC}/kernel/guard.ts; kernel is reached only through ${SRC}/kernel/index.ts`,
    ]);
  });

  it('fails a legacy path', () => {
    expect(importErrors(plant({ [`${SRC}/tickets.ts`]: 'export const x = 1;' }), [])).toEqual([
      `${SRC}/tickets.ts: legacy path; move it into kernel/, modules/<name>/ or seed/`,
    ]);
    const file = `${SRC}/modules/plant/a.ts`;
    expect(importErrors(plant({ [file]: "import '../../auth.js';" }), [])).toEqual([
      `${file}: imports legacy path ${SRC}/auth.ts`,
    ]);
  });

  it('fails a call the manifest does not allow', () => {
    const file = `${SRC}/modules/plant/a.ts`;
    const exception = [{ file, module: 'tickets', until: 't' }];
    const calling = plant({ [file]: "import { x } from '../tickets/index.js';" });
    expect(importErrors(calling, [])).toEqual([
      `${file}: plant may not call tickets (${SRC}/modules/tickets/index.ts)`,
    ]);
    expect(importErrors(calling, exception)).toEqual([]);
    const stale = `${file}: EXCEPTIONS lists tickets but the file no longer imports it; remove it`;
    expect(importErrors(plant({ [file]: 'export {};' }), exception)).toEqual([stale]);
    expect(importErrors(plant({ [`${SRC}/index.ts`]: 'export {};' }), exception)).toEqual([stale]);
  });

  it('keeps module imports out of the kernel', () => {
    const file = `${SRC}/kernel/a.ts`;
    const root = plant({ [file]: "import { m } from '../modules/plant/index.js';" });
    expect(importErrors(root, [])).toEqual([
      `${file}: the kernel imports no module (${SRC}/modules/plant/index.ts)`,
    ]);
  });

  it('fails a module folder missing from the manifest', () => {
    const file = `${SRC}/modules/zzz/index.ts`;
    expect(importErrors(plant({ [file]: 'export {};' }), [])).toEqual([
      `${file}: module zzz is not in the manifest`,
    ]);
  });

  it('lets the seed reach modules only through their index', () => {
    const seed = `${SRC}/seed/a.ts`;
    const index = plant({ [seed]: "import { x } from '../modules/plant/index.js';" });
    expect(importErrors(index, [])).toEqual([]);
    const inner = plant({ [seed]: "import { x } from '../modules/plant/repo/config.js';" });
    expect(importErrors(inner, [])).toEqual([
      `${seed}: imports ${SRC}/modules/plant/repo/config.ts; plant is reached only through ${SRC}/modules/plant/index.ts`,
    ]);
    const module = `${SRC}/modules/plant/a.ts`;
    expect(importErrors(plant({ [module]: "import '../../seed/cosmos.js';" }), [])).toEqual([
      `${module}: a module may not import ${SRC}/seed/cosmos.ts`,
    ]);
  });

  it('lists the dated call exceptions, so they can only shrink', () => {
    expect(EXCEPTIONS.map((e) => `${e.file} -> ${e.module}`)).toEqual(
      [
        'plant/service.ts -> accountability',
        'tickets/routes.ts -> accountability',
        'tickets/list.ts -> accountability',
        'imports/bhavin.ts -> accountability',
        'imports/cli.ts -> accountability',
      ].map((row) => `${SRC}/modules/${row}`),
    );
  });

  it("passes the server tree's imports", () => {
    expect(importErrors(process.cwd())).toEqual([]);
  });
});
