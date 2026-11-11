import { readFileSync } from 'node:fs';
import { createPool } from '../db.js';
import { resolveTenant } from '../tenant.js';
import { importBhavin, undoImport } from './bhavin.js';

function usage(): never {
  console.error('usage: import:bhavin <file.json> --tenant <slug>');
  console.error('       import:undo <batchId> --tenant <slug>');
  process.exit(2);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length < 1) usage();
  const isUndo = argv[0] === 'undo';
  const target = isUndo ? argv[1] : argv[0];
  if (!target) usage();
  const tenantIndex = argv.indexOf('--tenant');
  const slug = tenantIndex >= 0 ? argv[tenantIndex + 1] : undefined;
  if (!slug) usage();

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = createPool(url);
  try {
    const tenant = await resolveTenant(pool, slug);
    if (!tenant) throw new Error(`Unknown tenant: ${slug}`);
    if (isUndo) {
      const result = await undoImport(pool, tenant.id, target);
      console.log(`Undone batch ${target}: removed ${result.deleted} ticket(s)`);
    } else {
      const input = JSON.parse(readFileSync(target, 'utf8')) as unknown;
      const { batchId, stats } = await importBhavin(pool, tenant.id, input);
      console.log(`Imported batch ${batchId}:`);
      console.log(JSON.stringify(stats, null, 2));
    }
  } finally {
    await pool.end();
  }
}
