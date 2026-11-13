import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Run before every push. Skipped: build, ui:check (slow), pr:size, parity:update (need the PR text), tests.
const STEPS = (
  'lint typecheck changelog:check docs:check boundaries pii:scan migrations:check ' +
  'migrations:immutable parity licences size deps shortcuts'
).split(' ');

export function changedFiles(outputs: string[], exists: (path: string) => boolean): string[] {
  const paths = outputs.flatMap((out) => out.split('\n').map((line) => line.trim()));
  return [...new Set(paths.filter(Boolean))].filter(exists);
}

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=off', ...args], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function run(step: string, args: string[]): void {
  try {
    execFileSync('pnpm', args, { stdio: 'inherit' });
  } catch {
    console.error(`precheck: FAILED at ${step} — fix it, rerun pnpm precheck`);
    process.exit(1);
  }
}

function main(): void {
  const diff = ['diff', '--name-only', '--diff-filter=ACMR'];
  const base = git(...diff, 'origin/main...HEAD');
  if (base === null)
    console.log(
      'precheck: no origin/main to compare with; formatting uncommitted and untracked files only',
    );
  const others = git('ls-files', '--others', '--exclude-standard');
  const files = changedFiles([base ?? '', git(...diff, 'HEAD') ?? '', others ?? ''], existsSync);
  const flags = ['--write', '--ignore-unknown', '--no-error-on-unmatched-pattern'];
  if (files.length > 0) run('prettier', ['exec', 'prettier', ...flags, '--', ...files]);
  for (const step of STEPS) run(step, ['run', step]);
  console.log(
    `precheck: OK — ${files.length} file(s) checked by prettier, ${STEPS.length} checks passed`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
