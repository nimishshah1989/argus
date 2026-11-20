import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { prReason } from './pr-reason.js';

const SOFT = 400;
export const HARD = 800;
const SKIP = [/pnpm-lock\.yaml$/, /^docs\//, /\.md$/, /migrations\//, /fixtures\//, /generated\//];

/** A large PR passes with the size:large label (LEAN_ALLOW_LARGE) or a `Large PR: <reason>` body line. */
export function largePrAllowed(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.LEAN_ALLOW_LARGE) || prReason(env.PR_BODY, 'Large PR') !== null;
}

function diffStat(): string {
  try {
    return execFileSync('git', ['diff', '--numstat', 'origin/main...HEAD'], { encoding: 'utf8' });
  } catch {
    return execFileSync('git', ['diff', '--numstat', 'HEAD~1...HEAD'], { encoding: 'utf8' });
  }
}

/** Changed lines and files in `git diff --numstat` output, without the lockfile, docs, migrations and fixtures. */
export function countChanged(stat: string): { changed: number; files: number } {
  let changed = 0;
  let files = 0;
  for (const line of stat.split('\n')) {
    const [added, deleted, path] = line.split('\t');
    if (!path || SKIP.some((re) => re.test(path))) continue;
    changed += Number(added) + Number(deleted);
    files += 1;
  }
  return { changed, files };
}

function main(): void {
  let stat: string;
  try {
    stat = diffStat();
  } catch {
    console.log('pr-size: no diff base yet, skipping');
    return;
  }
  const { changed, files } = countChanged(stat);
  console.log(`pr-size: ${changed} changed lines across ${files} code files`);
  if (changed > HARD && !largePrAllowed(process.env)) {
    console.error(
      `pr-size: FAIL over ${HARD} lines; split the PR, add the size:large label, or put a line "Large PR: <reason>" (at least 10 characters) in the PR description`,
    );
    process.exitCode = 1;
  } else if (changed > SOFT) {
    console.warn(`pr-size: warn over ${SOFT} lines; justify in the PR`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
