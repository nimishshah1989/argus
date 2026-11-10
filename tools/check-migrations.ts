import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'packages/db/migrations';
const DESTRUCTIVE = /^\s*(drop\s+table|drop\s+column|truncate|delete\s+from)\b/im;
const APPROVED = /--\s*destructive-approved/i;

function main(): void {
  if (!existsSync(DIR)) {
    console.log('migrations: none yet');
    return;
  }
  const files = readdirSync(DIR).filter((name) => name.endsWith('.sql'));
  const bad = files.filter((name) => {
    const sql = readFileSync(join(DIR, name), 'utf8');
    return DESTRUCTIVE.test(sql) && !APPROVED.test(sql);
  });
  console.log(`migrations: ${files.length} files, ${bad.length} destructive without approval`);
  for (const name of bad) {
    console.error(
      `migrations: ${name} is destructive; add -- destructive-approved and a backup step`,
    );
  }
  if (bad.length) process.exitCode = 1;
}

main();
