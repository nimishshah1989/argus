import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { prReason } from './pr-reason.js';

/**
 * Changelog discipline (ticket 01): a pull request adds exactly one fragment,
 * `changes/<issue>-<slug>.md`, and does not edit CHANGELOG.md. A merge train may add one per
 * ticket when its description carries a `Merge train: <reason>` line. Skips when there is no diff
 * base, like check-parity-update.
 */

export interface ChangedFile {
  status: string;
  path: string;
}

export interface ChangelogOptions {
  train: boolean;
}

export const FRAGMENT = /^changes\/\d+-[a-z0-9-]+\.md$/;

export function changelogErrors(
  files: ChangedFile[],
  opts: ChangelogOptions = { train: false },
): string[] {
  const added = files.filter((f) => f.status === 'A' && f.path.startsWith('changes/'));
  const errors = added
    .filter((f) => !FRAGMENT.test(f.path))
    .map((f) => `${f.path}: name a fragment changes/<issue>-<slug>.md`);
  if (opts.train) {
    if (added.length === 0)
      errors.push(`add at least one changelog fragment under changes/ (found ${added.length})`);
  } else if (added.length !== 1) {
    errors.push(`add exactly one changelog fragment under changes/ (found ${added.length})`);
  }
  return errors;
}

function changedFiles(): ChangedFile[] | null {
  for (const range of ['origin/main...HEAD', 'HEAD~1...HEAD']) {
    try {
      const output = execFileSync('git', ['diff', '--name-status', '--no-renames', range], {
        encoding: 'utf8',
      });
      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [status = '', path = ''] = line.split('\t');
          return { status, path };
        });
    } catch {
      // The base is unavailable (no remote, shallow clone, first commit); try the next one.
    }
  }
  return null;
}

function main(): void {
  const files = changedFiles();
  if (files === null) {
    console.log('changelog: no diff base yet, skipping');
    return;
  }
  const errors = changelogErrors(files, {
    train: prReason(process.env.PR_BODY, 'Merge train') !== null,
  });
  console.log(`changelog: ${files.length} changed files, ${errors.length} problem(s)`);
  for (const error of errors) console.error(`changelog: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
