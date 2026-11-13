import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Migrations may not lose history (ARCHITECTURE §9 item 22): a guarded statement needs a header approval. */

const DIR = 'packages/db/migrations';

export type RuleName =
  'DROP' | 'UPDATE' | 'TRUNCATE' | 'DELETE FROM' | 'SET NOT NULL' | 'ALTER TYPE' | 'REVOKE';

export interface Finding {
  rule: RuleName;
  line: number;
}

export interface MigrationException {
  file: string;
  merged: string;
  reason: string;
}

const predates = (file: string, merged: string): MigrationException => ({
  file,
  merged,
  reason: 'predates the rule',
});

/** The seven files merged before this rule; no later file may be added. */
export const EXCEPTIONS: readonly MigrationException[] = [
  predates('0001_schema_v1.sql', '2026-11-10'),
  predates('0002_app_api_role.sql', '2026-11-10'),
  predates('0003_command_idempotency_binding.sql', '2026-11-10'),
  predates('0004_cancel_time.sql', '2026-11-11'),
  predates('0005_ticket_tag.sql', '2026-11-11'),
  predates('0006_severity_matrix.sql', '2026-11-12'),
  predates('0007_sla_policy_timer.sql', '2026-11-12'),
];

const RULES: readonly [RuleName, RegExp][] = [
  ['DROP', /\bdrop\b/gi],
  ['UPDATE', /\bupdate\s+(?:only\s+)?[\w."$]+(?:\s*\*)?\s+(?:(?:as\s+)?[\w$]+\s+)?set\b/gi],
  ['TRUNCATE', /\btruncate\b/gi],
  ['DELETE FROM', /\bdelete\s+from\b/gi],
  ['SET NOT NULL', /\bset\s+not\s+null\b/gi],
  ['ALTER TYPE', /\balter\s+(?:type\b|(?:column\s+)?"?[\w$]+"?\s+(?:set\s+data\s+)?type\b)/gi],
  ['REVOKE', /\brevoke\b/gi],
];

const spaces = (text: string): string => text.replace(/[^\n]/g, ' ');

/** Index just past the (nested) block comment that starts at `start`. */
function blockEnd(sql: string, start: number): number {
  let depth = 0;
  for (let i = start; i < sql.length; i++) {
    const pair = sql.slice(i, i + 2);
    if (pair === '/*' || pair === '*/') {
      depth += pair === '/*' ? 1 : -1;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return sql.length;
}

/** One pass: comments (`--`, nested block) become spaces, newlines kept. Quoted text is kept and scanned;
 *  dollar quotes are not strings, so DO bodies stay scanned. */
function blankComments(sql: string): string {
  let out = '';
  let quote = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i] ?? '';
    const pair = sql.slice(i, i + 2);
    if (quote !== '') {
      out += c;
      if (c === quote) quote = '';
    } else if (pair === '--' || pair === '/*') {
      const end =
        pair === '--' ? (sql.indexOf('\n', i) + 1 || sql.length + 1) - 1 : blockEnd(sql, i);
      out += spaces(sql.slice(i, end));
      i = end - 1;
    } else {
      out += c;
      if (c === "'" || c === '"') quote = c;
    }
  }
  return out;
}

/** Every guarded statement in one file's SQL, comments blanked out, line numbers 1-based. */
export function guardedStatements(sql: string): Finding[] {
  const clean = blankComments(sql);
  const found: Finding[] = [];
  for (const [rule, pattern] of RULES)
    for (const m of clean.matchAll(pattern))
      found.push({ rule, line: clean.slice(0, m.index).split('\n').length });
  return found.sort((a, b) => a.line - b.line);
}

/** True when the leading comment block carries both `-- approved-by:` and `-- backup:` with text. */
export function hasApproval(sql: string): boolean {
  const header: string[] = [];
  for (const line of sql.split('\n')) {
    const t = line.trim();
    if (t !== '' && !t.startsWith('--')) break;
    header.push(t);
  }
  const has = (key: string): boolean =>
    header.some((t) => new RegExp(String.raw`^--\s*${key}:\s*\S`, 'i').test(t));
  return has('approved-by') && has('backup');
}

/** One message per unapproved finding, skipping EXCEPTIONS by file name. */
export function scanMigrations(dir: string = DIR): string[] {
  if (!existsSync(dir)) return [];
  const skip = new Set(EXCEPTIONS.map((e) => e.file));
  const messages: string[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.sql') && !skip.has(n))) {
    const sql = readFileSync(join(dir, name), 'utf8');
    if (hasApproval(sql)) continue;
    for (const f of guardedStatements(sql))
      messages.push(
        `migrations: ${name}:${f.line}: ${f.rule} needs '-- approved-by:' and '-- backup:' in the file header`,
      );
  }
  return messages;
}

function main(): void {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((n) => n.endsWith('.sql')).length : 0;
  const errors = scanMigrations();
  console.log(`migrations: ${files} files, ${errors.length} findings`);
  for (const message of errors) console.error(message);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
