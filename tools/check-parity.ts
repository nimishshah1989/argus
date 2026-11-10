import { pathToFileURL } from 'node:url';
import { counts, loadParity, validateParity } from './parity.js';

function main(): void {
  const file = loadParity();
  const errors = validateParity(file);
  const byStatus = [...counts(file.rows).entries()]
    .map(([status, n]) => `${status}=${n}`)
    .join(' ');
  const byMilestone = new Map<string, number>();
  for (const row of file.rows) {
    byMilestone.set(row.milestone, (byMilestone.get(row.milestone) ?? 0) + 1);
  }
  console.log(`parity: ${file.rows.length} rows (${byStatus})`);
  console.log(
    `parity by milestone: ${[...byMilestone.entries()].map(([m, n]) => `${m}=${n}`).join(' ')}`,
  );
  if (errors.length) {
    for (const error of errors) console.error(`parity: ${error}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
