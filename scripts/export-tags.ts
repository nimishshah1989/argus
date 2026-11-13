import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { withTenant } from '../packages/db/src/tenant.js';
import { listTenants, operatorPool } from './operator-db.js';

// PostgreSQL's own text output for every column, so the down file's \copy reloads it unchanged.
const AS_TEXT = { getTypeParser: () => (value: string) => value };

/** Empty unquoted is NULL; anything with a comma, quote or line break (or empty text) is quoted. */
export function csvField(value: string | null): string {
  if (value === null) return '';
  return value === '' || /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function exportTags(out: string): Promise<void> {
  const pool = operatorPool();
  try {
    const exists = await pool.query("SELECT to_regclass('public.ticket_tag') IS NOT NULL AS yes");
    let header: string[] = [];
    const lines: string[] = [];
    for (const { id } of exists.rows[0].yes ? await listTenants(pool) : []) {
      await withTenant(pool, id, async (client) => {
        const result = await client.query<string[]>({
          text: 'SELECT * FROM ticket_tag WHERE tenant_id = $1 ORDER BY created_at, id',
          values: [id],
          rowMode: 'array',
          types: AS_TEXT,
        });
        header = result.fields.map((field) => field.name);
        for (const row of result.rows) lines.push(row.map(csvField).join(','));
      });
    }
    if (lines.length === 0) {
      console.log('export-tags: nothing to export');
      return;
    }
    mkdirSync(out, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const path = join(out, `ticket_tag-${stamp}.csv`);
    writeFileSync(path, `${[header.join(','), ...lines].join('\n')}\n`);
    console.log(`export-tags: ${lines.length} rows written to ${path}`);
    console.log(`export-tags: migrate with PGOPTIONS='-c uptimo.tags_exported=${lines.length}'`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = parseArgs({ options: { out: { type: 'string' } }, strict: false }).values.out;
  if (typeof out !== 'string') {
    console.error('usage: export-tags --out <dir>');
    process.exit(2);
  }
  exportTags(out).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
