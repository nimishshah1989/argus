import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  CALLS,
  EXCEPTIONS,
  OWNERS,
  type CallException,
} from '../apps/server/src/modules/manifest.js';

/**
 * Module boundaries (tickets 02, 03): SQL on a module's tables lives only in that module's repo.ts
 * (or repo/ folder), every file belongs to kernel/, modules/<m>/ or seed/, and modules reach each
 * other only through index.ts, in the direction the manifest allows. LEGACY is empty.
 */

export const SERVER_SRC = 'apps/server/src';

export { OWNERS };

export type Baseline = Readonly<Record<string, readonly string[]>>;

export const LEGACY: Baseline = {};

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

const NAME = String.raw`(?:only\s+)?(?:lateral\s+)?(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`;
const AFTER_KEYWORD = new RegExp(String.raw`\b(?:join|into|update)\s+${NAME}`, 'gi');
// A FROM list runs to the next clause keyword; a flat (...) group is part of the list.
const FROM_LIST =
  /\bfrom\s+((?:[^;()]|\([^()]*\))*?)(?=\b(?:where|join|on|group|order|limit|union|returning|set|having|for|using|window)\b|[;)]|$)/gi;
const FROM_ITEM = new RegExp(String.raw`^\s*${NAME}`, 'i');

export function tablesNamed(sql: string): string[] {
  const names = [...sql.matchAll(AFTER_KEYWORD)].map((m) => m[1] ?? '');
  for (const list of sql.matchAll(FROM_LIST))
    for (const item of (list[1] ?? '').split(',')) names.push(item.match(FROM_ITEM)?.[1] ?? '');
  return [...new Set(names.filter(Boolean).map((name) => name.toLowerCase()))].sort();
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

/** The owner's repo.ts, or any file in its repo/ folder (SQL-heavy modules split their repo). */
const inRepo = (file: string, repo: string): boolean =>
  file === repo || file.startsWith(`${dirname(repo)}/repo/`);

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
      if (owner && !inRepo(file, repo) && !legacy[file]?.includes(table))
        errors.push(`${file}: SQL names ${table} (owned by ${owner}); only ${repo} may`);
    }
  }
  for (const [file, tables] of Object.entries(legacy))
    for (const table of tables)
      if (!named.get(file)?.includes(table))
        errors.push(`${file}: LEGACY lists ${table} but the file no longer names it; remove it`);
  return errors;
}

type Unit = { kind: 'kernel' | 'seed' | 'root' | 'legacy' } | { kind: 'module'; name: string };

const ROOT_FILES = ['app.ts', 'index.ts', 'modules/index.ts', 'modules/manifest.ts'].map(
  (file) => `${SERVER_SRC}/${file}`,
);

function unitOf(file: string): Unit {
  if (file.startsWith(`${SERVER_SRC}/kernel/`)) return { kind: 'kernel' };
  if (file.startsWith(`${SERVER_SRC}/seed/`)) return { kind: 'seed' };
  const name = file.slice(`${SERVER_SRC}/modules/`.length).split('/');
  if (file.startsWith(`${SERVER_SRC}/modules/`) && name.length > 1)
    return { kind: 'module', name: name[0] as string };
  return { kind: ROOT_FILES.includes(file) ? 'root' : 'legacy' };
}

/** Repo-relative `.ts` files a source file imports or re-exports, in source order. */
function importsOf(root: string, file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
  );
  const targets: string[] = [];
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const spec = node.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec) || !spec.text.startsWith('.')) continue;
    const target = posix.join(posix.dirname(file), spec.text).replace(/\.js$/, '.ts');
    if (target.endsWith('.ts') && target.startsWith(`${SERVER_SRC}/`)) targets.push(target);
  }
  return targets;
}

/** Rules for a unit reaching into kernel/, seed/ or the root (everything but module-to-module). */
function unitError(file: string, target: string): string | null {
  const from = unitOf(file);
  const to = unitOf(target);
  if (to.kind === 'legacy') return `${file}: imports legacy path ${target}`;
  if (from.kind === 'kernel' && to.kind !== 'kernel')
    return `${file}: the kernel imports no module (${target})`;
  if (from.kind === 'module' && (to.kind === 'root' || to.kind === 'seed'))
    return `${file}: a module may not import ${target}`;
  const index = `${SERVER_SRC}/kernel/index.ts`;
  if (to.kind === 'kernel' && from.kind !== 'kernel' && target !== index)
    return `${file}: imports ${target}; kernel is reached only through ${index}`;
  return null;
}

function moduleError(file: string, target: string, calls: readonly string[]): string | null {
  const from = unitOf(file);
  const to = unitOf(target);
  if (to.kind !== 'module' || (from.kind === 'module' && from.name === to.name)) return null;
  const index = `${SERVER_SRC}/modules/${to.name}/index.ts`;
  if (target !== index)
    return `${file}: imports ${target}; ${to.name} is reached only through ${index}`;
  if (from.kind === 'module' && !calls.includes(to.name))
    return `${file}: ${from.name} may not call ${to.name} (${target})`;
  return null;
}

function fileErrors(root: string, file: string, exceptions: readonly CallException[]) {
  const unit = unitOf(file);
  const errors: string[] = [];
  const modules = new Set<string>();
  if (unit.kind === 'legacy')
    return {
      errors: [`${file}: legacy path; move it into kernel/, modules/<name>/ or seed/`],
      modules,
    };
  if (unit.kind === 'module' && !CALLS[unit.name])
    return { errors: [`${file}: module ${unit.name} is not in the manifest`], modules };
  const calls = unit.kind === 'module' ? (CALLS[unit.name] ?? []) : [];
  for (const target of importsOf(root, file)) {
    const to = unitOf(target);
    if (to.kind === 'module') modules.add(to.name);
    const excepted = exceptions.filter((e) => e.file === file).map((e) => e.module);
    const error = unitError(file, target) ?? moduleError(file, target, [...calls, ...excepted]);
    if (error) errors.push(error);
  }
  return { errors, modules };
}

export function importErrors(
  root: string,
  exceptions: readonly CallException[] = EXCEPTIONS,
): string[] {
  const errors: string[] = [];
  const imported = new Map<string, Set<string>>();
  for (const file of serverFiles(root)) {
    const result = fileErrors(root, file, exceptions);
    errors.push(...result.errors);
    imported.set(file, result.modules);
  }
  for (const e of exceptions)
    if (!imported.get(e.file)?.has(e.module))
      errors.push(
        `${e.file}: EXCEPTIONS lists ${e.module} but the file no longer imports it; remove it`,
      );
  return errors;
}

function main(): void {
  const errors = [...boundaryErrors(process.cwd()), ...importErrors(process.cwd())];
  console.log(
    `boundaries: ${serverFiles(process.cwd()).length} files scanned, ${errors.length} problem(s)`,
  );
  for (const error of errors) console.error(`boundaries: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
