import { lstat, realpath, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Pool } from 'pg';
import { withTenant } from '../packages/db/src/tenant.js';
import { erasePerson } from '../apps/server/src/modules/identity/repo/erasure.js';
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
       erase-person --tenant <slug> --person <uuid> --request <ref> --operator <who> --review-done
exit codes: 0 complete, 1 failed or files left behind, 2 bad arguments, 3 hand review still pending
needs ERASURE_HASH_KEY (at least 32 characters) in the environment: without it nothing is erased`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Args {
  tenant: string;
  request: string;
  operator: string;
  person: string;
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
    if (!tenant || !request?.trim() || !operator?.trim() || !person || !UUID.test(person)) {
      return undefined;
    }
    const reviewDone = v['review-done'] === true;
    if (!reviewDone && !v['files-dir']) return undefined;
    return { tenant, request, operator, person, filesDir: v['files-dir'], reviewDone };
  } catch {
    return undefined;
  }
}

/** Personal data is never reported erased while a term went unsearched or no text could be searched. */
const needsReview = (counts: Record<string, unknown>): boolean =>
  counts.text_searched !== true || Number(counts.skipped_short_terms ?? 0) > 0;

const isUnder = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** The directory the stored files live in, resolved once so a symlinked path cannot move it later. */
async function filesRoot(dir: string): Promise<string> {
  try {
    const real = await realpath(dir);
    if ((await stat(real)).isDirectory()) return real;
  } catch {
    // reported below
  }
  throw new Error(`erase: --files-dir ${dir} is not a directory`);
}

/** A key is unsafe when it is absolute, climbs out, or its folder is a link that leads outside the root. */
async function isUnsafe(root: string, key: string): Promise<boolean> {
  if (isAbsolute(key) || key.includes('..')) return true;
  const target = resolve(root, key);
  if (!isUnder(root, target)) return true;
  try {
    const folder = await realpath(join(target, '..'));
    return folder !== root && !isUnder(root, folder);
  } catch {
    return false; // the folder does not exist, so there is no file to remove
  }
}

/** Erases inside one transaction, so an unsafe storage key leaves the database untouched. */
async function erase(pool: Pool, tenantId: string, args: Args, root: string) {
  return withTenant(pool, tenantId, async (client) => {
    const done = await client.query(
      "SELECT 1 FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase' AND entity_id = $2",
      [tenantId, args.person],
    );
    if (done.rowCount) throw new Error('erase: this person is already erased');
    const { s3_keys: keys, ...counts } = await erasePerson(client, {
      tenantId,
      personId: args.person,
      requestRef: args.request,
      operator: args.operator,
    });
    for (const key of keys) {
      if (await isUnsafe(root, key)) throw new Error(`erase: unsafe storage key ${key}`);
    }
    return { keys, counts };
  });
}

async function recordReview(pool: Pool, tenantId: string, args: Args): Promise<void> {
  await withTenant(pool, tenantId, async (client) => {
    const erased = await client.query(
      `SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase'
        AND entity_id = $2 AND after ->> 'request_ref' = $3 ORDER BY at DESC LIMIT 1`,
      [tenantId, args.person, args.request],
    );
    const row = erased.rows[0];
    if (!row) throw new Error('no erasure with that request reference for this person');
    if (!needsReview(row.after)) return;
    const done = await client.query(
      `SELECT 1 FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase.review'
        AND entity_id = $2 AND after ->> 'request_ref' = $3`,
      [tenantId, args.person, args.request],
    );
    if (done.rowCount) return;
    await client.query(
      `INSERT INTO audit_log (tenant_id, action, entity, entity_id, after)
       VALUES ($1, 'person.erase.review', 'person', $2, $3)`,
      [
        tenantId,
        args.person,
        JSON.stringify({ request_ref: args.request, operator: args.operator }),
      ],
    );
  });
}

/** Removes the stored files after the commit, prints what was done, and returns the exit code. */
async function finish(root: string, keys: string[], counts: Record<string, unknown>) {
  const left: string[] = [];
  for (const key of keys) {
    const path = join(root, key);
    try {
      await lstat(path);
      await rm(path);
    } catch {
      left.push(key); // missing or not removable: the rows are gone, so print every key still owed
    }
  }
  console.log(JSON.stringify(counts));
  const review = needsReview(counts);
  if (review) {
    for (const line of HAND_REVIEW) console.log(line);
    if (counts.text_searched === true) {
      console.log('erase: a short name or username was not searched; check it by hand too');
    }
  }
  if (left.length > 0) {
    console.error(`erase: stored files missing or not removed: ${left.join(', ')}`);
    return 1;
  }
  if (review) {
    console.log('erase: review pending: record it with --review-done');
    return 3;
  }
  console.log('erase: complete');
  return 0;
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
    const root = await filesRoot(args.filesDir ?? '');
    const { keys, counts } = await erase(pool, tenant.id, args, root);
    return await finish(root, keys, counts);
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
