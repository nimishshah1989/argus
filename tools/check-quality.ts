import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * The per-change quality gate (D32, docs/QUALITY-ATTRIBUTES.md). `pnpm quality` runs the auto
 * attributes a command can decide; `pnpm quality:pr` adds the PR-body evidence contract in CI.
 * The pure scanners live here so they are testable without git or CI.
 */

export const IDS: readonly string[] = Array.from({ length: 14 }, (_, i) => `Q${i + 1}`);
export const REVIEW = 'Q1 Q3 Q4 Q8 Q9 Q10 Q11 Q14';

const REMOVED_ASSERTION = /\bexpect\s*\(/;
const REMOVED_TEST = /\b(?:it|test)(?:\.(?:each|only|skip|todo|concurrent))?\s*\(/;
const ADDED_SKIP = /\.skip\s*\(/;
const ADDED_ONLY = /\.only\s*\(/;
const ADDED_TODO = /\b(it|test)\.todo\s*\(/;
const TEST_FILE = /\.test\.tsx?$/;
const PREVIEW_LINE = /^[ \t]*(?:[-*][ \t]+)?preview[ \t]*:/im;
const DECISION_LINE = /^[ \t]*(?:[-*][ \t]+)?decisions?[ \t]*:/im;

function stripComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, '');
}

function diffPath(line: string): string | null {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
  return match?.[2] ?? null;
}

function deletedTestFiles(lines: string[]): Set<string> {
  const deleted = new Set<string>();
  let path = '';
  for (const line of lines) {
    const header = diffPath(line);
    if (header) path = header;
    else if (line.startsWith('--- a/')) path = line.slice(6).trim();
    else if (line.startsWith('deleted file mode') && TEST_FILE.test(path)) deleted.add(path);
  }
  return deleted;
}

function removedFinding(line: string): string | null {
  if (!line.startsWith('-') || line.startsWith('---')) return null;
  if (REMOVED_ASSERTION.test(line)) return 'removed assertion';
  if (REMOVED_TEST.test(line)) return 'removed test';
  return null;
}

function addedFinding(line: string): string | null {
  if (!line.startsWith('+')) return null;
  if (ADDED_SKIP.test(line)) return 'added .skip';
  if (ADDED_ONLY.test(line)) return 'added .only';
  const todo = ADDED_TODO.exec(line);
  return todo ? `added ${todo[1] ?? 'it'}.todo` : null;
}

/** Deleted or weakened tests in a `git diff origin/main...HEAD`, one human-readable finding each. */
export function weakenedTests(diffText: string): string[] {
  const lines = diffText.split('\n');
  const deleted = deletedTestFiles(lines);
  const findings = [...deleted].map((file) => `${file}: deleted test file`);
  let path = '';
  for (const line of lines) {
    const header = diffPath(line);
    if (header) {
      path = header;
      continue;
    }
    if (line.startsWith('--- a/')) {
      path = line.slice(6).trim();
      continue;
    }
    if (deleted.has(path)) continue;
    const finding = removedFinding(line) ?? addedFinding(line);
    if (finding) findings.push(`${path}: ${finding}`);
  }
  return findings;
}

/** The ids Q1..Q14 a PR body never declared as a line starting `Q<id>`. */
export function missingAttributes(body: string): string[] {
  const declared = new Set<string>();
  for (const match of stripComments(body).matchAll(/^[ \t]*(?:[-*][ \t]+)?Q(\d{1,2})\b/gm)) {
    if (match[1]) declared.add(`Q${match[1]}`);
  }
  return IDS.filter((id) => !declared.has(id));
}

/** The evidence sections a PR body must carry: what changed, how to try it, what must be decided. */
export function missingSections(body: string): string[] {
  const text = stripComments(body);
  const headings = [...text.matchAll(/^#{1,6}[ \t]+(.+)$/gm)].map((m) =>
    (m[1] ?? '').toLowerCase(),
  );
  const missing: string[] = [];
  if (!headings.some((heading) => heading.includes('what changed')))
    missing.push('What changed and why');
  if (!headings.some((heading) => /try|preview/.test(heading)) && !PREVIEW_LINE.test(text))
    missing.push('How to try it');
  if (!headings.some((heading) => heading.includes('decid')) && !DECISION_LINE.test(text))
    missing.push('What must be decided');
  return missing;
}

/** The reason a PR author wrote as `Tests removed: <reason>` (at least 10 characters), or null. */
export function testsRemovedReason(body: string | undefined): string | null {
  const match = /^[ \t]*(?:[-*][ \t]+)?Tests removed[ \t]*:[ \t]*(.+)$/im.exec(
    stripComments(body ?? ''),
  );
  const reason = match?.[1]?.trim() ?? '';
  return reason.replace(/\s/g, '').length >= 10 ? reason : null;
}

interface Check {
  id: string;
  label: string;
  ok: boolean;
  skipped?: string;
  note?: string;
}

function hasOriginMain(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'origin/main'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitDiff(): string | null {
  try {
    return execFileSync('git', ['diff', 'origin/main...HEAD'], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function pnpm(args: string[], env: NodeJS.ProcessEnv = {}): boolean {
  try {
    execFileSync('pnpm', args, { stdio: 'pipe', env: { ...process.env, ...env } });
    return true;
  } catch {
    return false;
  }
}

function testIntegrity(): Check {
  const check: Check = { id: 'Q2', label: 'test integrity', ok: false };
  if (!hasOriginMain()) return { ...check, skipped: 'no origin/main to compare with' };
  const diff = gitDiff();
  if (diff === null) return { ...check, skipped: 'no diff base yet' };
  const findings = weakenedTests(diff);
  if (findings.length === 0) return { ...check, ok: true };
  if (testsRemovedReason(process.env.PR_BODY)) return { ...check, ok: true };
  return { ...check, note: findings.join('; ') };
}

function commandCheck(
  id: string,
  label: string,
  commands: string[][],
  env: NodeJS.ProcessEnv = {},
): Check {
  const failed = commands.find((args) => !pnpm(args, env));
  return { id, label, ok: failed === undefined, note: failed?.join(' ') };
}

function runLocal(): void {
  const checks = [
    testIntegrity(),
    commandCheck('Q5', 'data safety', [
      ['run', 'migrations:check'],
      ['run', 'migrations:immutable'],
    ]),
    commandCheck('Q6', 'lean budgets', [['run', 'pr:size']], {
      PR_BODY: process.env.PR_BODY ?? '',
    }),
    commandCheck('Q7', 'design lock', [['run', 'ui:check']]),
    commandCheck('Q12', 'evidence and memory', [['run', 'changelog:check']]),
    commandCheck('Q13', 'secrets and data', [['run', 'pii:scan']]),
  ];
  for (const check of checks) {
    const status = check.skipped ? `skip — ${check.skipped}` : check.ok ? 'pass' : 'fail';
    const note = check.note && !check.skipped ? ` — ${check.note}` : '';
    console.log(`${check.id.padEnd(4)}${check.label.padEnd(22)}${status}${note}`);
  }
  const failed = checks.filter((check) => !check.ok && !check.skipped);
  console.log(`quality: ${checks.length} auto attributes, ${failed.length} failed`);
  console.log(`review attributes: ${REVIEW}`);
  if (failed.length > 0) process.exitCode = 1;
}

function runPr(): void {
  const body = process.env.PR_BODY ?? '';
  const missingIds = missingAttributes(body);
  const missing = missingSections(body);
  const problems: string[] = [];
  if (missingIds.length > 0) problems.push(`missing attributes: ${missingIds.join(' ')}`);
  if (missing.length > 0) problems.push(`missing sections: ${missing.join(', ')}`);
  if (hasOriginMain()) {
    const findings = weakenedTests(gitDiff() ?? '');
    if (findings.length > 0 && testsRemovedReason(body) === null)
      problems.push(`weakened tests:\n  ${findings.join('\n  ')}`);
  } else {
    console.log('quality:pr: no origin/main to compare with, skipping the test-integrity scan');
  }
  if (problems.length > 0) {
    for (const problem of problems) console.log(`quality:pr FAIL — ${problem}`);
    console.log('quality:pr: see docs/QUALITY-ATTRIBUTES.md and .github/pull_request_template.md');
    process.exitCode = 1;
    return;
  }
  console.log('quality:pr OK — 14 attributes declared, no weakened tests');
}

function main(): void {
  if (process.argv.includes('--pr')) runPr();
  else runLocal();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
