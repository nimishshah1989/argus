import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ENGLISH_WORDS,
  PHONE,
  loadDenyList,
  normalisePhone,
  scanList,
  type DenyList,
} from './pii-sources.js';

/**
 * PII scan (ticket 01): CI fails when a real Cosmos name or phone number from the source lists appears in a
 * tracked file. Errors give the file, line and kind, never the value.
 */

export function scannedPaths(paths: string[]): string[] {
  return paths.filter((path) => !path.startsWith('docs/discovery/') && path !== 'pnpm-lock.yaml');
}

function nameRegex(names: string[]): RegExp | undefined {
  if (names.length === 0) return undefined;
  const parts = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${parts.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
}

/** A name that is also an English word counts only when written with a capital, as a name is. */
function wordRegex(names: string[]): RegExp | undefined {
  const words = names.filter((name) => ENGLISH_WORDS.has(name));
  if (words.length === 0) return undefined;
  const capitalised = words.map((name) => name[0]!.toUpperCase() + name.slice(1));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${capitalised.join('|')})(?![\\p{L}\\p{N}_])`, 'u');
}

export function scanText(path: string, text: string, deny: DenyList): string[] {
  const names = nameRegex(deny.names.filter((name) => !ENGLISH_WORDS.has(name)));
  const words = wordRegex(deny.names);
  const phones = new Set(deny.phones);
  const errors: string[] = [];
  text.split('\n').forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    if (names?.test(line) || words?.test(line))
      errors.push(`${at}: real name from the source lists`);
    if ([...line.matchAll(PHONE)].some((m) => phones.has(normalisePhone(m[0]))))
      errors.push(`${at}: real phone from the source lists`);
  });
  return errors;
}

function isBinary(full: string): boolean {
  const fd = openSync(full, 'r');
  try {
    const head = Buffer.alloc(8000);
    return head.subarray(0, readSync(fd, head, 0, 8000, 0)).includes(0);
  } finally {
    closeSync(fd);
  }
}

export function scanFiles(root: string, paths: string[], deny: DenyList): string[] {
  return paths.flatMap((path) => {
    const full = join(root, path);
    return isBinary(full) ? [] : scanText(path, readFileSync(full, 'utf8'), deny);
  });
}

function main(): void {
  const started = performance.now();
  const deny = scanList(loadDenyList());
  const listed = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const paths = scannedPaths(listed.split('\0').filter(Boolean));
  const errors = scanFiles(process.cwd(), paths, deny);
  const ms = Math.round(performance.now() - started);
  console.log(
    `pii: ${deny.names.length} names and ${deny.phones.length} phones from the source lists; ${paths.length} files scanned; ${errors.length} problem(s) (${ms} ms)`,
  );
  for (const error of errors) console.error(`pii: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
