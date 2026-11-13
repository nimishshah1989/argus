import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { prReason } from './pr-reason.js';

/**
 * Parity discipline (M6): a pull request that changes product code under `apps/` or `packages/`
 * must also update `docs/spec/parity.yaml`, or carry the `no-parity` label with a reason in the
 * PR description (mirrors the `size:large` pattern for `tools/check-pr-size.ts`).
 * Skips when there is no diff base, like check-pr-size.
 */

const PRODUCT = /^(apps|packages)\//;
const LEDGER = 'docs/spec/parity.yaml';

/** The ledger rule is skipped by the no-parity label (PARITY_ALLOW_SKIP) or a `No parity: <reason>` body line. */
export function paritySkipAllowed(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.PARITY_ALLOW_SKIP) || prReason(env.PR_BODY, 'No parity') !== null;
}

export function parityUpdateErrors(files: string[]): string[] {
  const product = files.filter((file) => PRODUCT.test(file));
  if (product.length === 0 || files.includes(LEDGER)) return [];
  return [
    `${product.length} product file(s) changed but ${LEDGER} did not; update the ledger, add the no-parity label, or put a line "No parity: <reason>" (at least 10 characters) in the PR description`,
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
  if (paritySkipAllowed(process.env)) {
    console.log(
      'parity:update: skipped via the no-parity label or a "No parity:" line in the PR description',
    );
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
