import { execFileSync } from 'node:child_process';

const SOFT = 400;
const HARD = 800;
const SKIP = [/pnpm-lock\.yaml$/, /^docs\//, /\.md$/, /migrations\//, /fixtures\//, /generated\//];

function diffStat(): string {
  try {
    return execFileSync('git', ['diff', '--numstat', 'origin/main...HEAD'], { encoding: 'utf8' });
  } catch {
    return execFileSync('git', ['diff', '--numstat', 'HEAD~1...HEAD'], { encoding: 'utf8' });
  }
}

function main(): void {
  let stat: string;
  try {
    stat = diffStat();
  } catch {
    console.log('pr-size: no diff base yet, skipping');
    return;
  }
  let changed = 0;
  let files = 0;
  for (const line of stat.split('\n')) {
    const [added, deleted, path] = line.split('\t');
    if (!path || SKIP.some((re) => re.test(path))) continue;
    changed += Number(added) + Number(deleted);
    files += 1;
  }
  console.log(`pr-size: ${changed} changed lines across ${files} code files`);
  if (changed > HARD && !process.env.LEAN_ALLOW_LARGE) {
    console.error(
      `pr-size: FAIL over ${HARD} lines; split the PR or set LEAN_ALLOW_LARGE with a reason`,
    );
    process.exitCode = 1;
  } else if (changed > SOFT) {
    console.warn(`pr-size: warn over ${SOFT} lines; justify in the PR`);
  }
}

main();
