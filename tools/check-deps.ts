import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageJson = { dependencies?: Record<string, string> };

function workspacePackages(): string[] {
  const out = [join(process.cwd(), 'package.json')];
  for (const dir of ['apps', 'packages']) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name, 'package.json');
      if (existsSync(path)) out.push(path);
    }
  }
  return out;
}

function main(): void {
  const thirdParty = readFileSync('THIRD_PARTY.md', 'utf8');
  const listed = new Set<string>();
  for (const line of thirdParty.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    const name = cells[1] ?? '';
    if (!name) continue;
    listed.add(name.toLowerCase());
    for (const part of name.toLowerCase().split(/[^a-z0-9@./-]+/)) if (part) listed.add(part);
  }
  const deps = new Set<string>();
  for (const path of workspacePackages()) {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
    for (const name of Object.keys(pkg.dependencies ?? {})) deps.add(name);
  }
  const missing = [...deps].filter(
    (name) => !name.startsWith('@argus/') && !listed.has(name.toLowerCase()),
  );
  console.log(`deps: ${deps.size} runtime dependencies`);
  for (const name of missing) {
    console.error(`deps: ${name} is not listed in THIRD_PARTY.md`);
  }
  if (missing.length) process.exitCode = 1;
}

main();
