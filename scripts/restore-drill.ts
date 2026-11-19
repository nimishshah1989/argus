import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

/**
 * `tsx scripts/restore-drill.ts` (Drill B, infra/RESTORE.md): dump a database, restore the dump into a new EMPTY
 * database, and check that the ten largest tables hold the same number of rows in both. Prints PASS or FAIL and
 * exits 1 on anything but a pass. Reads the source and creates and drops one scratch database next to it; the
 * source is never written. Needs `pg_dump` and `pg_restore` (Postgres 16 or newer) on the PATH and a login that
 * may create a database and is exempt from row security (the weekly dump has the same need, infra/instance/dump.sh).
 * Run it with `DRILL_SOURCE_URL` (default `MIGRATION_DATABASE_URL`).
 */

export const DRILL_TABLES = 10;
const APP_ROLES = ['app_user', 'app_router', 'app_api'];

type Queryable = Pick<Pool, 'query'>;

export interface TableCount {
  table: string;
  rows: number;
}

export interface DrillRow extends TableCount {
  restored: number;
  equal: boolean;
}

export interface DrillResult {
  ok: boolean;
  /** Set when the drill stopped before it could compare anything. */
  stopped?: string;
  dumpBytes?: number;
  rows: DrillRow[];
}

/** The tables of the public schema with their exact row counts, largest first (name breaks ties). */
export async function largestTables(pool: Queryable, limit = DRILL_TABLES): Promise<TableCount[]> {
  const names = await pool.query(
    `SELECT quote_ident(c.relname) AS name FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition`,
  );
  const counted: TableCount[] = [];
  for (const { name } of names.rows as Array<{ name: string }>)
    counted.push({ table: name, rows: await countRows(pool, name) });
  counted.sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));
  return counted.slice(0, limit);
}

async function countRows(pool: Queryable, quotedTable: string): Promise<number> {
  return Number(
    (await pool.query(`SELECT count(*)::text AS n FROM public.${quotedTable}`)).rows[0].n,
  );
}

/** Pairs each source count with the restored one; a table the restore lacks counts as -1, never as equal. */
export function compareCounts(source: TableCount[], restored: Map<string, number>): DrillRow[] {
  return source.map(({ table, rows }) => {
    const found = restored.get(table) ?? -1;
    return { table, rows, restored: found, equal: found === rows };
  });
}

/** libpq cannot read node-pg's `sslmode=no-verify` (it means "encrypt, do not check": libpq's `require`). Every other setting stays. */
export function libpqUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.searchParams.get('sslmode') === 'no-verify')
    parsed.searchParams.set('sslmode', 'require');
  return parsed.toString();
}

/** Runs a Postgres client command; the URL, file and snapshot go in the environment, so no password reaches the process list. */
function tool(script: string, url: string, file: string, snapshot = ''): ToolRun {
  const run = spawnSync('sh', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, DRILL_URL: libpqUrl(url), DRILL_FILE: file, DRILL_SNAPSHOT: snapshot },
  });
  return { ok: run.status === 0, stderr: (run.stderr ?? '') + (run.error?.message ?? '') };
}

interface ToolRun {
  ok: boolean;
  stderr: string;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/**
 * pg_restore ends with "errors ignored" for one harmless note (the `public` schema already exists), and a dump from a
 * newer pg_dump starts with `SET transaction_timeout`, which an older server rejects. Those two are the only
 * errors ignored; every other `pg_restore: error:` line is real. The row counts still decide PASS.
 */
export function realRestoreErrors(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => line.startsWith('pg_restore: error:'))
    .filter((line) => !line.endsWith('ERROR:  schema "public" already exists'))
    .filter((line) => !line.endsWith('unrecognized configuration parameter "transaction_timeout"'));
}

async function mayBypassRowSecurity(pool: Pool): Promise<boolean> {
  const row = await pool.query(
    'SELECT rolsuper OR rolbypassrls AS yes FROM pg_roles WHERE rolname = current_user',
  );
  return row.rows[0]?.yes === true;
}

/** The dump's policies are written TO the application roles, so they must exist before the restore (they are server-wide). */
async function ensureRoles(pool: Pool): Promise<void> {
  for (const role of APP_ROLES)
    await pool.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF;
      END $$`);
}

async function restoredCounts(url: string, wanted: TableCount[]): Promise<Map<string, number>> {
  const pool = new Pool({ connectionString: url, max: 1 });
  const found = new Map<string, number>();
  try {
    const have = new Set((await largestTables(pool, Number.MAX_SAFE_INTEGER)).map((t) => t.table));
    for (const { table } of wanted)
      if (have.has(table)) found.set(table, await countRows(pool, table));
  } finally {
    await pool.end();
  }
  return found;
}

/** What went wrong in one line, with any connection string removed (it can hold the password). */
function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return (text.split('\n')[0] ?? '').replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>');
}

/** Any thrown failure (connection refused, no `pg_dump`, no right to create a database) becomes a STOP, never a stack trace. */
export async function runRestoreDrill(sourceUrl: string): Promise<DrillResult> {
  try {
    return await drill(sourceUrl);
  } catch (error) {
    return stop(describe(error));
  }
}

/** Counts the largest tables and dumps inside one exported snapshot, so writes during the drill cannot make a FAIL. */
async function snapshotDump(
  source: Pool,
  sourceUrl: string,
  file: string,
): Promise<{ largest: TableCount[]; dump: ToolRun }> {
  const client = await source.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const id = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id as string;
    const largest = await largestTables(client);
    const script = 'pg_dump "$DRILL_URL" -Fc --snapshot="$DRILL_SNAPSHOT" -f "$DRILL_FILE"';
    return { largest, dump: tool(script, sourceUrl, file, id) };
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

async function drill(sourceUrl: string): Promise<DrillResult> {
  const source = new Pool({ connectionString: sourceUrl, max: 2 });
  const work = mkdtempSync(join(tmpdir(), 'restore-drill-'));
  const scratch = `restore_drill_${Date.now()}`;
  const state = { created: false };
  let result: DrillResult;
  let leftBehind = false;
  try {
    result = await restoreAndCount(source, { sourceUrl, work, scratch, state });
  } finally {
    if (state.created)
      leftBehind = await source.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`).then(
        () => false,
        () => true,
      );
    await source.end();
    rmSync(work, { recursive: true, force: true });
    if (leftBehind)
      console.error(`could not drop the scratch database ${scratch}; drop it by hand`);
  }
  // A PASS must mean nothing is left behind.
  if (!leftBehind) return result;
  const left = `the scratch database ${scratch} could not be dropped; drop it by hand`;
  return stop(
    result.ok
      ? `the restore passed but ${left}`
      : `${result.stopped ?? 'the drill failed'}; ${left}`,
  );
}

interface DrillPaths {
  sourceUrl: string;
  work: string;
  scratch: string;
  state: { created: boolean };
}

async function restoreAndCount(source: Pool, paths: DrillPaths): Promise<DrillResult> {
  const { sourceUrl, work, scratch, state } = paths;
  if (!(await mayBypassRowSecurity(source)))
    return stop('this login is subject to row security; a dump from it would be incomplete');
  const file = join(work, 'drill.dump');
  const { largest, dump } = await snapshotDump(source, sourceUrl, file);
  if (!dump.ok) return stop(`pg_dump failed: ${dump.stderr.trim().split('\n')[0]}`);
  if ((largest[0]?.rows ?? 0) === 0) return stop('the source database holds no rows to compare');
  await ensureRoles(source);
  await source.query(`CREATE DATABASE ${scratch}`);
  state.created = true;
  const scratchUrl = withDatabase(sourceUrl, scratch);
  const restore = tool(
    'pg_restore --no-owner --no-privileges -d "$DRILL_URL" "$DRILL_FILE"',
    scratchUrl,
    file,
  );
  const errors = realRestoreErrors(restore.stderr);
  if (errors.length > 0) return stop(`the restore had errors: ${errors[0]}`);
  // pg_restore exits 1 after harmless notes and says "errors ignored on restore: N"; a non-zero exit without that
  // summary is a kill or a crash, however many harmless lines came before it.
  if (!restore.ok && !/errors ignored on restore: \d+/.test(restore.stderr))
    return stop('pg_restore did not finish');
  const rows = compareCounts(largest, await restoredCounts(scratchUrl, largest));
  return { ok: rows.every((r) => r.equal), dumpBytes: statSync(file).size, rows };
}

function stop(reason: string): DrillResult {
  return { ok: false, stopped: reason, rows: [] };
}

export function formatReport(result: DrillResult): string {
  if (result.stopped) return `RESTORE DRILL STOP: ${result.stopped}. Nothing was compared.`;
  const lines = result.rows.map(
    (r) =>
      `${r.equal ? 'PASS' : 'FAIL'}  ${r.table}: ${r.rows} rows in the source, ${r.restored < 0 ? 'table missing' : `${r.restored} rows restored`}`,
  );
  const equal = result.rows.filter((r) => r.equal).length;
  const head = `dump of ${result.dumpBytes} bytes restored into an empty database`;
  const verdict = result.ok
    ? `RESTORE DRILL PASS: ${equal} of ${result.rows.length} largest tables have equal row counts`
    : `RESTORE DRILL FAIL: ${result.rows.length - equal} of ${result.rows.length} largest tables differ`;
  return [head, ...lines, verdict].join('\n');
}

async function main(): Promise<void> {
  const url = process.env.DRILL_SOURCE_URL ?? process.env.MIGRATION_DATABASE_URL;
  const result = url
    ? await runRestoreDrill(url)
    : stop('DRILL_SOURCE_URL or MIGRATION_DATABASE_URL is required');
  console.log(formatReport(result));
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
