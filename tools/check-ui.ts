import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * UI guard (ticket 10, D19). Files under faces/ are built from the kit only: no className or
 * style, no raw colour, at most 120 lines per .tsx. lucide-react is imported only by ui/icon.ts.
 */

export interface UiFile {
  path: string; // relative to webSrc, '/' separators
  text: string;
}

const FACES_LINES = 120;
const FACES_RULES: [string, RegExp][] = [
  ['className in faces/', /\bclassName\s*=/],
  ['style in faces/', /\bstyle\s*=/],
  ['raw colour in faces/', /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/],
];
const LUCIDE = /from\s+['"]lucide-react['"]/;

export function readWebSrc(webSrc: string): UiFile[] {
  const files: UiFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push({
          path: relative(webSrc, full).split('\\').join('/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };
  walk(webSrc);
  return files;
}

export function uiErrors(files: UiFile[]): string[] {
  const errors: string[] = [];
  for (const { path, text } of files) {
    const lines = text.replace(/\n$/, '').split('\n');
    const faces = path.startsWith('faces/');
    lines.forEach((line, i) => {
      if (faces)
        for (const [message, pattern] of FACES_RULES)
          if (pattern.test(line)) errors.push(`${path}:${i + 1}: ${message}`);
      if (path !== 'ui/icon.ts' && LUCIDE.test(line))
        errors.push(`${path}:${i + 1}: lucide-react outside ui/icon.ts`);
    });
    if (faces && path.endsWith('.tsx') && lines.length > FACES_LINES)
      errors.push(`${path}: ${lines.length} lines (faces limit ${FACES_LINES})`);
  }
  return errors;
}

function main(): void {
  const files = readWebSrc(process.argv[2] ?? 'apps/web/src');
  const errors = uiErrors(files);
  console.log(`ui: ${files.length} files, ${errors.length} problem(s)`);
  for (const error of errors) console.error(`ui: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
