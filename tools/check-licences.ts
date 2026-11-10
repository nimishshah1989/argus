import { execFileSync } from 'node:child_process';

const ALLOWED =
  /^(MIT|ISC|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD|MPL-2\.0|OFL-1\.1|CC0-1\.0|CC-BY-4\.0|Unlicense|BlueOak-1\.0\.0)\*?$/i;

type Entry = { license?: string } | string;

function main(): void {
  let raw: string;
  try {
    raw = execFileSync('pnpm', ['licenses', 'list', '--json', '--prod'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    console.error('licences: pnpm licenses failed; run pnpm install first');
    process.exitCode = 1;
    return;
  }
  if (!raw.trim().startsWith('{')) {
    console.log('licences: no production dependencies yet');
    return;
  }
  const data = JSON.parse(raw) as Record<string, Entry[]>;
  const bad: string[] = [];
  let count = 0;
  for (const [name, entries] of Object.entries(data)) {
    if (name.startsWith('argus@') || name.startsWith('@argus/')) continue;
    for (const entry of entries) {
      const licence = typeof entry === 'string' ? entry : (entry.license ?? 'UNKNOWN');
      count += 1;
      if (!ALLOWED.test(licence)) bad.push(`${name}: ${licence}`);
    }
  }
  console.log(`licences: ${count} production licence entries, ${bad.length} outside the allowlist`);
  for (const entry of bad) console.error(`licences: ${entry}`);
  if (bad.length) process.exitCode = 1;
}

main();
