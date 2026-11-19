import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Docs guard (ticket 01): CI fails when an instruction file names a build process other than
 * pstack (D23), when a stack document names Drizzle (the repo uses raw SQL on pg, D02), or when the
 * progress tracker still says `todo` for a ticket that has a merged feat or fix commit (ticket 73).
 */

export interface DocFile {
  path: string;
  text: string;
}

export const INSTRUCTION_FILES: readonly string[] = [
  'CLAUDE.md',
  'AGENTS.md',
  'docs/LEAN.md',
  'docs/TESTING.md',
  'docs/HANDOFF.md',
];

export const STACK_FILES: readonly string[] = [
  'docs/adr/0001-stack.md',
  'docs/spec/SPEC.md',
  'THIRD_PARTY.md',
];

export const PROCESS_MARKERS: readonly { label: string; pattern: RegExp }[] = [
  { label: 'DeepSeek', pattern: /\bdeepseek\b/i },
  { label: 'OpenRouter', pattern: /\bopenrouter\b/i },
  { label: 'nemotron', pattern: /\bnemotron\b/i },
  { label: 'TwIL', pattern: /\btwil\b/i },
  { label: 'ollama', pattern: /\bollama\b/i },
  { label: 'free coder', pattern: /\bfree coder\b/i },
  { label: 'DSH', pattern: /\bDSH\b/ },
];

export function instructionPaths(root = process.cwd()): string[] {
  const dir = join(root, '.claude/agents');
  const agents = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `.claude/agents/${name}`)
    : [];
  return [...INSTRUCTION_FILES, ...agents];
}

export function readDocs(paths: string[], root = process.cwd()): DocFile[] {
  return paths.map((path) => {
    const full = join(root, path);
    if (!existsSync(full)) throw new Error(`docs: missing ${path}`);
    return { path, text: readFileSync(full, 'utf8') };
  });
}

function lineErrors(
  files: DocFile[],
  markers: readonly { pattern: RegExp; message: (label: string) => string; label: string }[],
  format: (path: string, line: number, message: string) => string,
): string[] {
  const errors: string[] = [];
  for (const file of files) {
    file.text.split('\n').forEach((text, index) => {
      for (const marker of markers) {
        if (marker.pattern.test(text))
          errors.push(format(file.path, index + 1, marker.message(marker.label)));
      }
    });
  }
  return errors;
}

export function processErrors(files: DocFile[]): string[] {
  return lineErrors(
    files,
    PROCESS_MARKERS.map((marker) => ({
      ...marker,
      message: (label) => `names a process other than pstack (${label})`,
    })),
    (path, line, message) => `${path}:${line}: ${message}`,
  );
}

export function drizzleErrors(files: DocFile[]): string[] {
  return lineErrors(
    files,
    [
      {
        label: 'Drizzle',
        pattern: /drizzle/i,
        message: () => 'names Drizzle; the repo uses raw SQL on pg (D02)',
      },
    ],
    (path, line, message) => `${path}:${line}: ${message}`,
  );
}

export const TRACKER_PATH = 'docs/plan/MILESTONES.md';

const STATUSES: readonly string[] = ['todo', 'in progress', 'done', 'parked', 'withdrawn'];
const NOT_FOUND = `${TRACKER_PATH}: tracker table not found or its Status column moved`;

/** The tracker's ticket rows as [ticket, status], the Status column found by its header cell. */
function trackerRows(tracker: string): [string, string][] {
  const section = /^## Progress tracker.*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(tracker)?.[1] ?? '';
  const rows = section.split('\n').map((line) => line.split('|').map((cell) => cell.trim()));
  const column = rows.find((cells) => cells.includes('Status'))?.indexOf('Status') ?? -1;
  if (column < 0) return [];
  return rows
    .filter((cells) => /^\d+$/.test(cells[1] ?? ''))
    .map((cells) => [cells[1] ?? '', cells[column] ?? '']);
}

/**
 * Tickets whose tracker row says `todo` while a `feat(NN…)` or `fix(NN…)` commit exists. Fails loudly
 * when the table, its Status column or a status word cannot be read, so a rename cannot go green.
 */
export function trackerErrors(tracker: string, subjects: readonly string[]): string[] {
  const rows = trackerRows(tracker);
  if (!rows.some(([, status]) => STATUSES.includes(status.toLowerCase()))) return [NOT_FOUND];
  const errors = rows
    .filter(([, status]) => !STATUSES.includes(status.toLowerCase()))
    .map(
      ([ticket, status]) =>
        `${TRACKER_PATH}: ticket ${ticket} has an unknown status "${status}" (allowed: ${STATUSES.join(', ')})`,
    );
  const todo = new Set(
    rows.filter(([, status]) => status.toLowerCase() === 'todo').map(([ticket]) => Number(ticket)),
  );
  const built = new Map<number, string>();
  for (const subject of subjects) {
    const match = /^(?:feat|fix)\((\d+)/.exec(subject);
    const ticket = match ? Number(match[1]) : NaN;
    if (todo.has(ticket) && !built.has(ticket)) built.set(ticket, subject);
  }
  const stale = [...built]
    .sort(([x], [y]) => x - y)
    .map(
      ([ticket, subject]) =>
        `${TRACKER_PATH}: ticket ${ticket} still says todo but history has "${subject}"`,
    );
  return [...errors, ...stale];
}

/**
 * Commit subjects on HEAD, or null when git or its history is unavailable. A shallow clone returns
 * only part of history (CI uses fetch-depth 0), so main() says so in the summary line.
 */
export function commitSubjects(): string[] | null {
  try {
    const out = execFileSync('git', ['log', '--format=%s'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const subjects = out.split('\n').filter(Boolean);
    return subjects.length > 0 ? subjects : null;
  } catch {
    return null;
  }
}

/** In CI an unreadable history must fail, or the stale-tracker check goes silently green. */
export function historyErrors(subjects: readonly string[] | null, ci: boolean): string[] {
  return subjects === null && ci ? ['could not read git history in CI, tracker not checked'] : [];
}

function isShallow(): boolean {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

function main(): void {
  const instructions = readDocs(instructionPaths());
  const stack = readDocs([...STACK_FILES]);
  const subjects = commitSubjects();
  const tracker = trackerErrors(readDocs([TRACKER_PATH])[0]?.text ?? '', subjects ?? []);
  const errors = [
    ...processErrors(instructions),
    ...drizzleErrors(stack),
    ...tracker,
    ...historyErrors(subjects, Boolean(process.env.CI)),
  ];
  const checked = subjects
    ? `${subjects.length} commits vs tracker${isShallow() ? ' (shallow history)' : ''}`
    : 'commits not checked (no git history)';
  console.log(
    `docs: ${instructions.length} instruction files, ${stack.length} stack files, ${checked}, ${errors.length} problem(s)`,
  );
  for (const error of errors) console.error(`docs: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
