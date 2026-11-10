import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Migration immutability (M10): after the first deploy an existing migration file must never
 * change. On a pull request this diffs the PR against origin/main and fails on a modified,
 * deleted, renamed or type-changed `packages/db/migrations/*.sql`; a NEW file is fine.
 * There is no diff base on a fresh clone or a direct push, so it skips like check-pr-size does.
 */

const MIGRATION = /^packages\/db\/migrations\/.+\.sql$/;
const EXISTING_CHANGED = /^[MDRT]/;

function parseNameStatus(output: string): { status: string; paths: string[] }[] {
  const rows: { status: string; paths: string[] }[] = [];
  for (const line of output.split('\n')) {
    const cells = line.trim().split('\t').filter(Boolean);
    const [status = '', ...paths] = cells;
    if (status) rows.push({ status, paths });
  }
  return rows;
}

/** The migration files touched by a `git diff --name-status` that may not change. */
export function migrationViolations(nameStatus: string): string[] {
  const problems: string[] = [];
  for (const { status, paths } of parseNameStatus(nameStatus)) {
    if (!EXISTING_CHANGED.test(status)) continue;
    // A rename touches two paths; only the old one is an existing migration that may not move.
    const existing = status.startsWith('R') ? paths.slice(0, 1) : paths;
    for (const path of existing) {
      if (MIGRATION.test(path)) problems.push(`${path} (${status})`);
    }
  }
  return problems;
}

function diff(): string | null {
  const ranges = process.env.MIGRATION_BASE
    ? [process.env.MIGRATION_BASE]
    : ['origin/main...HEAD', 'HEAD~1...HEAD'];
  for (const range of ranges) {
    try {
      return execFileSync('git', ['diff', '--name-status', range], { encoding: 'utf8' });
    } catch {
      // The base is unavailable (no remote, shallow clone, first commit); try the next one.
    }
  }
  return null;
}

function main(): void {
  const output = diff();
  if (output === null) {
    console.log('migrations:immutable: no diff base yet, skipping');
    return;
  }
  const problems = migrationViolations(output);
  console.log(`migrations:immutable: ${problems.length} existing migration files changed`);
  for (const problem of problems) {
    console.error(
      `migrations:immutable: ${problem} was modified; add a new migration file instead`,
    );
  }
  if (problems.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
