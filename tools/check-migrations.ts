import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Migrations may not lose history (ARCHITECTURE §9 item 22): a guarded statement needs a header approval. */

const DIR = 'packages/db/migrations';

export type RuleName =
  | 'DROP'
  | 'UPDATE'
  | 'TRUNCATE'
  | 'DELETE FROM'
  | 'SET NOT NULL'
  | 'ALTER TYPE'
  | 'REVOKE'
  | 'EXECUTE'
  | 'UNPAIRED $';

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

/** Any non-ASCII character counts as part of a name (when in doubt, flag: a false positive only costs an approval). */
const NAME = String.raw`[\w$\u0080-\uffff]+`;
/** A quoted name, plain or unicode-escaped: `"my table"`, `U&"\0074icket"`. */
const QUOTED = String.raw`(?:u&)?"(?:[^"]|"")*"`;
/** A plain or quoted identifier, optionally schema-qualified: `t`, `"my table"`, `public."t"`. */
const IDENT = String.raw`(?:${NAME}|${QUOTED})(?:\.(?:${NAME}|${QUOTED}))*`;

const RULES: readonly [RuleName, RegExp][] = [
  ['DROP', /\bdrop\b/gi],
  [
    'UPDATE',
    new RegExp(
      String.raw`\bupdate\s+(?:only\s+)?${IDENT}(?:\s*\*)?\s+(?:(?:as\s+)?(?:${NAME}|${QUOTED})\s+)?set\b`,
      'gi',
    ),
  ],
  ['TRUNCATE', /\btruncate\b/gi],
  ['DELETE FROM', /\bdelete\s+from\b/gi],
  ['SET NOT NULL', /\bset\s+not\s+null\b/gi],
  [
    'ALTER TYPE',
    new RegExp(
      String.raw`\balter\s+(?:type\b|(?:column\s+)?${IDENT}\s+(?:set\s+data\s+)?type\b)`,
      'gi',
    ),
  ],
  ['REVOKE', /\brevoke\b/gi],
  // Dynamic SQL (a DO body or a prepared statement) can build any statement from pieces; the function and
  // trigger forms and a GRANT EXECUTE are not dynamic.
  ['EXECUTE', /(?<!')\bexecute\b(?!\s+(?:function|procedure|on)\b)/gi],
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

/** The `$tag$` that opens a dollar quote at `i` (not inside a name such as `a$b$`), or undefined. */
function dollarTag(sql: string, i: number): string | undefined {
  if (/[\w$\u0080-\uffff]/.test(sql[i - 1] ?? '')) return undefined;
  return /^\$(?:[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*)?\$/.exec(sql.slice(i, i + 80))?.[0];
}

/** Index just past the quoted text that opens at `start`. A doubled quote is part of the text; in `E'...'`
 *  a backslash escapes the next character. */
function quotedEnd(sql: string, start: number): number {
  const quote = sql[start];
  const escapes =
    quote === "'" && /^e$/i.test(sql[start - 1] ?? '') && !/[\w$]/.test(sql[start - 2] ?? '');
  for (let i = start + 1; i < sql.length; i++) {
    if (sql[i] === '\\' && escapes) i++;
    else if (sql[i] === quote) {
      if (sql[i + 1] !== quote) return i + 1;
      i++;
    }
  }
  return sql.length;
}

/** Index just past the dollar-quoted span that opens at `start`, or -1 when none opens there. A span with no
 *  closing tag runs to the end of the file and its start is added to `unpaired`. */
function dollarEnd(sql: string, start: number, unpaired: number[]): number {
  const tag = dollarTag(sql, start);
  if (tag === undefined) return -1;
  const close = sql.indexOf(tag, start + tag.length);
  if (close === -1) unpaired.push(start);
  return close === -1 ? sql.length : close + tag.length;
}

/** One pass: comments (`--`, nested block) become spaces, newlines kept. Quoted text is kept and scanned.
 *  Nothing inside a `$tag$...$tag$` span is blanked (a DO body stays scanned, comments and all: a comment
 *  there can cost a false positive, never a hidden statement). */
function blankComments(sql: string, unpaired: number[]): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i] ?? '';
    const pair = sql.slice(i, i + 2);
    if (pair === '--' || pair === '/*') {
      const end =
        pair === '--' ? (sql.indexOf('\n', i) + 1 || sql.length + 1) - 1 : blockEnd(sql, i);
      out += spaces(sql.slice(i, end));
      i = end;
      continue;
    }
    const end =
      c === "'" || c === '"' ? quotedEnd(sql, i) : c === '$' ? dollarEnd(sql, i, unpaired) : -1;
    out += end === -1 ? c : sql.slice(i, end);
    i = end === -1 ? i + 1 : end;
  }
  return out;
}

/** Every guarded statement in one file's SQL, comments blanked out, line numbers 1-based. */
export function guardedStatements(sql: string): Finding[] {
  const unpaired: number[] = [];
  const clean = blankComments(sql, unpaired);
  const lineAt = (index: number | undefined): number => clean.slice(0, index).split('\n').length;
  const found: Finding[] = unpaired.map((i) => ({ rule: 'UNPAIRED $', line: lineAt(i) }));
  for (const [rule, pattern] of RULES)
    for (const m of clean.matchAll(pattern)) found.push({ rule, line: lineAt(m.index) });
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
