import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ENGLISH_WORDS,
  PHONE,
  SCAN_PRINCIPALS,
  loadDenyList,
  normalisePhone,
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

const PROSE_PATH = /\.(?:md|mdx|txt|rst|html?)$/i;
const SQL_PATH = /\.sql$/i;

/** Docs and prose files may name the project's own principals. */
export function isProsePath(path: string): boolean {
  return path.startsWith('docs/') || PROSE_PATH.test(path);
}

const blank = (value: string): string => value.replace(/[^\n]/g, ' ');

const lineEnd = (text: string, start: number): number => {
  const end = text.indexOf('\n', start);
  return end === -1 ? text.length : end;
};

const blockEnd = (text: string, start: number): number => {
  const end = text.indexOf('*/', start + 2);
  return end === -1 ? text.length : end + 2;
};

/** The index just past the closing quote; the end of the text when the quote is never closed. */
function quoteEnd(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === quote && text[index - 1] !== '\\') return index + 1;
    index += 1;
  }
  return text.length;
}

const wordCount = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;

interface Span {
  stop: number;
  /** A short string is a value and is scanned; a comment or a sentence is prose and is blanked. */
  prose: boolean;
}

const QUOTES = new Set(['"', "'", '`']);

/** The comment or quoted string that opens at `index`, and how far it runs. */
function spanAt(text: string, index: number, dash: boolean): Span | undefined {
  const char = text[index] ?? '';
  const next = text[index + 1] ?? '';
  const line = (char === '/' && next === '/') || (dash && char === '-' && next === '-');
  if (line) return { stop: lineEnd(text, index), prose: true };
  if (char === '/' && next === '*') return { stop: blockEnd(text, index), prose: true };
  if (!QUOTES.has(char)) return undefined;
  const stop = quoteEnd(text, index);
  return { stop, prose: wordCount(text.slice(index + 1, stop - 1)) >= 4 };
}

/**
 * Blank comments and sentence-length strings. A principal name there is prose, not data; a name
 * held as a short value ("Bhavin", "Bhavin P") is left in place and flagged. `dash` turns on the
 * `--` line comments a SQL migration carries its approval prose in.
 */
function proseMask(text: string, dash = false): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const span = spanAt(text, index, dash);
    if (span === undefined) {
      out += text[index];
      index += 1;
    } else {
      const part = text.slice(index, span.stop);
      out += span.prose ? blank(part) : part;
      index = span.stop;
    }
  }
  return out;
}

function nameLines(text: string, names: string[]): Set<number> {
  const regexes = [nameRegex(names.filter((name) => !ENGLISH_WORDS.has(name))), wordRegex(names)];
  const lines = new Set<number>();
  text.split('\n').forEach((line, index) => {
    if (regexes.some((regex) => regex?.test(line))) lines.add(index + 1);
  });
  return lines;
}

/** A principal is a person only when written as a name: the lowercase token is our source tag. */
function principalRegex(names: string[]): RegExp | undefined {
  if (names.length === 0) return undefined;
  const title = (name: string): string => name.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  const parts = [...new Set(names.map(title))]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${parts.join('|')})(?![\\p{L}\\p{N}_])`, 'u');
}

export function scanText(path: string, text: string, deny: DenyList): string[] {
  const principals = deny.names.filter((name) => SCAN_PRINCIPALS.has(name));
  const otherLines = nameLines(
    text,
    deny.names.filter((name) => !SCAN_PRINCIPALS.has(name)),
  );
  const principal = isProsePath(path) ? undefined : principalRegex(principals);
  const principalLines = new Set<number>();
  if (principal?.test(text)) {
    proseMask(text, SQL_PATH.test(path))
      .split('\n')
      .forEach((line, index) => {
        if (principal.test(line)) principalLines.add(index + 1);
      });
  }
  const phones = new Set(deny.phones);
  const errors: string[] = [];
  text.split('\n').forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    if (otherLines.has(index + 1) || principalLines.has(index + 1))
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
    // A loop build folder is a sparse checkout without the holdout tests; git still lists them.
    if (!existsSync(full)) return [];
    return isBinary(full) ? [] : scanText(path, readFileSync(full, 'utf8'), deny);
  });
}

function main(): void {
  const started = performance.now();
  const deny = loadDenyList();
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
