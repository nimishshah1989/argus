import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Parity discipline (M6): a pull request that changes product code under `apps/` or `packages/`
 * must also update `docs/spec/parity.yaml`, or carry the `no-parity` label with a reason in the
 * PR description (mirrors the `size:large` pattern for `tools/check-pr-size.ts`).
 * Skips when there is no diff base, like check-pr-size.
 */

const PRODUCT = /^(apps|packages)\//;
const LEDGER = 'docs/spec/parity.yaml';

export function parityUpdateErrors(files: string[]): string[] {
  const product = files.filter((file) => PRODUCT.test(file));
  if (product.length === 0 || files.includes(LEDGER)) return [];
  return [
    `${product.length} product file(s) changed but ${LEDGER} did not; update the ledger or add the no-parity label with a reason`,
  ];
}

function changedFiles(): string[] | null {
  for (const range of ['origin/main...HEAD', 'HEAD~1...HEAD']) {
    try {
      const output = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
      return output.split('\n').filter(Boolean);
    } catch {
      // The base is unavailable (no remote, shallow clone, first commit); try the next one.
    }
  }
  return null;
}

function main(): void {
  if (process.env.PARITY_ALLOW_SKIP) {
    console.log('parity:update: skipped via the no-parity label; state the reason in the PR');
    return;
  }
  const files = changedFiles();
  if (files === null) {
    console.log('parity:update: no diff base yet, skipping');
    return;
  }
  const errors = parityUpdateErrors(files);
  console.log(`parity:update: ${files.length} changed files, ${errors.length} problem(s)`);
  for (const error of errors) console.error(`parity:update: ${error}`);
  if (errors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
