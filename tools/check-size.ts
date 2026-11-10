import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HARD = 400;
const WARN = 250;
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'migrations', 'fixtures', 'generated']);

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) out.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

function lineCount(path: string): number {
  return readFileSync(path, 'utf8').split('\n').length;
}

function allowed(path: string): boolean {
  const head = readFileSync(path, 'utf8').split('\n').slice(0, 5).join('\n');
  return head.includes('lean-allow:');
}

function main(): void {
  const files = ['apps', 'packages', 'tools', 'scripts'].flatMap(sourceFiles);
  const rows = files.map((path) => ({ path, lines: lineCount(path) }));
  const hard = rows.filter((row) => row.lines > HARD && !allowed(row.path));
  const warn = rows.filter((row) => row.lines > WARN && row.lines <= HARD);
  const total = rows.reduce((sum, row) => sum + row.lines, 0);

  console.log(`size: ${rows.length} source files, ${total} lines`);
  for (const row of rows.sort((a, b) => b.lines - a.lines).slice(0, 10)) {
    console.log(`  ${row.lines.toString().padStart(4)}  ${row.path}`);
  }
  for (const row of warn)
    console.warn(`size: warn ${row.path} is ${row.lines} lines (soft ${WARN})`);
  for (const row of hard)
    console.error(`size: FAIL ${row.path} is ${row.lines} lines (hard ${HARD})`);
  if (hard.length) process.exitCode = 1;
}

main();
