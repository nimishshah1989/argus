import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', 'dist', 'coverage', 'migrations', 'fixtures', 'generated']);

function codeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) out.push(...codeFiles(path));
    } else if (/\.(ts|tsx|js|sql)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

function main(): void {
  const debt = readFileSync('docs/plan/DEBT.md', 'utf8');
  const found: string[] = [];
  for (const path of ['apps', 'packages'].flatMap(codeFiles)) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const at = line.indexOf('shortcut:');
      if (at >= 0) found.push(`${path}:${index + 1} ${line.slice(at + 9).trim()}`);
    });
  }
  const unledgered = found.filter((entry) => !debt.includes(entry.split(' ').slice(1).join(' ')));
  console.log(`shortcuts: ${found.length} found, ${unledgered.length} not in docs/plan/DEBT.md`);
  for (const entry of unledgered) console.error(`shortcuts: ${entry}`);
  if (unledgered.length) process.exitCode = 1;
}

main();
