import { rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Pool } from 'pg';
import { withTenant } from '../packages/db/src/tenant.js';
import { listTenants, operatorPool } from './operator-db.js';

/** DATA-MAP §5, last paragraph: what the plant checks by hand when no text could be searched. */
export const HAND_REVIEW: readonly string[] = [
  'Ticket text: problem, location, close note, waiting-for-spare note, task reason and corrected values',
  'Ticket history: the notes and stored details of every history line',
  'Breakdown reports: every typed field, including "observed by" and "handed over to"',
  "Import rows and the import batch's lists and messages",
  'Audit lines about other people',
  "Other people's stored repeat-guard replies",
  'The signature image on any report handed over to this person',
];

const USAGE = `usage: erase-person --tenant <slug> --person <uuid> --request <ref> --operator <who> --files-dir <dir>
       erase-person --tenant <slug> --review-done --request <ref> --operator <who>`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Args {
  tenant: string;
  request: string;
  operator: string;
  person?: string;
  filesDir?: string;
  reviewDone: boolean;
}

function parse(argv: string[]): Args | undefined {
  try {
    const v = parseArgs({
      args: argv,
      options: {
        tenant: { type: 'string' },
        person: { type: 'string' },
        request: { type: 'string' },
        operator: { type: 'string' },
        'files-dir': { type: 'string' },
        'review-done': { type: 'boolean' },
      },
    }).values;
    const { tenant, request, operator, person } = v;
    if (!tenant || !request?.trim() || !operator?.trim()) return undefined;
    const reviewDone = v['review-done'] === true;
    if (!reviewDone && (!person || !UUID.test(person) || !v['files-dir'])) return undefined;
    return { tenant, request, operator, person, filesDir: v['files-dir'], reviewDone };
  } catch {
    return undefined;
  }
}

const isUnsafe = (key: string): boolean => isAbsolute(key) || key.includes('..');

/** Erases inside one transaction, so an unsafe storage key leaves the database untouched. */
async function erase(pool: Pool, tenantId: string, args: Args) {
  return withTenant(pool, tenantId, async (client) => {
    const found = await client.query('SELECT 1 FROM person WHERE id = $1 AND tenant_id = $2', [
      args.person,
      tenantId,
    ]);
    if (found.rowCount !== 1) throw new Error('erase: person not found in this tenant');
    const result = await client.query('SELECT erase_person($1, $2, $3) AS r', [
      args.person,
      args.request,
      args.operator,
    ]);
    const { s3_keys: keys, ...counts } = result.rows[0].r as { s3_keys: string[] } & Record<
      string,
      unknown
    >;
    const unsafe = keys.find(isUnsafe);
    if (unsafe !== undefined) throw new Error(`erase: unsafe storage key ${unsafe}`);
    return { keys, counts };
  });
}

async function recordReview(pool: Pool, tenantId: string, args: Args): Promise<void> {
  await withTenant(pool, tenantId, async (client) => {
    const erased = await client.query(
      `SELECT entity_id, after FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase'
        AND after ->> 'request_ref' = $2 ORDER BY at DESC LIMIT 1`,
      [tenantId, args.request],
    );
    const row = erased.rows[0];
    if (!row) throw new Error('no erasure with that request reference');
    if (row.after.text_searched === true) return;
    const done = await client.query(
      `SELECT 1 FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase.review'
        AND after ->> 'request_ref' = $2`,
      [tenantId, args.request],
    );
    if (done.rowCount) return;
    await client.query(
      `INSERT INTO audit_log (tenant_id, action, entity, entity_id, after)
       VALUES ($1, 'person.erase.review', 'person', $2, $3)`,
      [
        tenantId,
        row.entity_id,
        JSON.stringify({ request_ref: args.request, operator: args.operator }),
      ],
    );
  });
}

async function main(argv: string[]): Promise<number> {
  const args = parse(argv);
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  const pool = operatorPool();
  try {
    const tenant = (await listTenants(pool)).find((t) => t.slug === args.tenant);
    if (!tenant) throw new Error(`Unknown tenant: ${args.tenant}`);
    if (args.reviewDone) {
      await recordReview(pool, tenant.id, args);
      console.log('erase: complete');
      return 0;
    }
    const { keys, counts } = await erase(pool, tenant.id, args);
    for (const [i, key] of keys.entries()) {
      try {
        await rm(join(args.filesDir ?? '', key), { force: true });
      } catch (error) {
        // The rows are already gone, so these keys are recorded nowhere else: print what is left.
        console.error(`erase: could not remove ${keys.slice(i).join(', ')}`);
        throw error;
      }
    }
    console.log(JSON.stringify(counts));
    if (counts.text_searched === true) {
      console.log('erase: complete');
      return 0;
    }
    for (const line of HAND_REVIEW) console.log(line);
    console.log('erase: review pending: record it with --review-done');
    return 3;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
