import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * Module boundaries (ticket 02): SQL on a moved module's tables lives only in that module's repo.ts.
 * LEGACY is the shrinking baseline of files that still break the rule; ticket 03 empties it.
 */

export const SERVER_SRC = 'apps/server/src';

export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  ops: ['audit_log'],
  identity: [
    'tenant',
    'person',
    'login',
    'session',
    'platform_access',
    'auth_lookup',
    'tenant_by_slug',
    'tenant_info',
  ],
  plant: [
    'segment',
    'machine_group',
    'machine',
    'machine_move',
    'list_item',
    'shift',
    'setting',
    'glossary_term',
    'ui_translation',
  ],
};

export type Baseline = Readonly<Record<string, readonly string[]>>;

export const LEGACY: Baseline = {
  'apps/server/src/auth.ts': ['auth_lookup', 'login', 'person', 'session'],
  'apps/server/src/config.ts': [
    'list_item',
    'machine',
    'machine_group',
    'person',
    'segment',
    'setting',
    'shift',
    'tenant_info',
  ],
  'apps/server/src/day-report.ts': ['machine', 'person', 'tenant_info'],
  'apps/server/src/import/references.ts': ['list_item', 'machine', 'person', 'shift'],
  'apps/server/src/import/undo.ts': ['audit_log'],
  'apps/server/src/push.ts': ['person'],
  'apps/server/src/reports.ts': ['machine', 'person', 'tenant_info'],
  'apps/server/src/settings.ts': ['audit_log', 'list_item', 'machine', 'setting', 'shift'],
  'apps/server/src/tag-sql.ts': ['list_item'],
  'apps/server/src/tenant.ts': ['tenant_by_slug'],
  'apps/server/src/ticket-report.ts': ['person', 'shift', 'tenant_info'],
  'apps/server/src/ticket-sql.ts': ['list_item', 'person'],
  'apps/server/src/ticket/severity.ts': ['machine', 'setting'],
  'apps/server/src/ticket/sla.ts': ['shift', 'tenant_info'],
  'apps/server/src/tickets.ts': ['machine'],
};

/** The text of every string literal and template literal (static parts), never comments or identifiers. */
export function sqlLiterals(source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (ts.isTemplateExpression(node))
      found.push([node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '));
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest));
  return found;
}

export function tablesNamed(sql: string): string[] {
  const names = [...sql.matchAll(/\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi)];
  return [...new Set(names.map((m) => (m[1] ?? '').toLowerCase()))].sort();
}

export function serverFiles(root: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
  return walk(SERVER_SRC).sort();
}

function ownerOf(table: string): string | undefined {
  return Object.keys(OWNERS).find((m) => OWNERS[m]?.includes(table));
}

export function boundaryErrors(root: string, legacy: Baseline = LEGACY): string[] {
  const errors: string[] = [];
  const named = new Map<string, string[]>();
  for (const file of serverFiles(root)) {
    const literals = sqlLiterals(readFileSync(join(root, file), 'utf8'));
    const tables = [...new Set(literals.flatMap(tablesNamed))].sort();
    named.set(file, tables);
    for (const table of tables) {
      const owner = ownerOf(table);
      const repo = `${SERVER_SRC}/modules/${owner}/repo.ts`;
      if (owner && file !== repo && !legacy[file]?.includes(table))
        errors.push(`${file}: SQL names ${table} (owned by ${owner}); only ${repo} may`);
    }
  }
  for (const [file, tables] of Object.entries(legacy))
    for (const table of tables)
      if (!named.get(file)?.includes(table))
        errors.push(`${file}: LEGACY lists ${table} but the file no longer names it; remove it`);
  return errors;
}

function main(): void {
  const errors = boundaryErrors(process.cwd());
  console.log(
    `boundaries: ${serverFiles(process.cwd()).length} files scanned, ${errors.length} problem(s)`,
  );
  for (const error of errors) console.error(`boundaries: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
