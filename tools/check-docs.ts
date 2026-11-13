import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Docs guard (ticket 01): CI fails when an instruction file names a build process other than
 * pstack (D23), or when a stack document names Drizzle (the repo uses raw SQL on pg, D02).
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

function main(): void {
  const instructions = readDocs(instructionPaths());
  const stack = readDocs([...STACK_FILES]);
  const errors = [...processErrors(instructions), ...drizzleErrors(stack)];
  console.log(
    `docs: ${instructions.length} instruction files, ${stack.length} stack files, ${errors.length} problem(s)`,
  );
  for (const error of errors) console.error(`docs: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
