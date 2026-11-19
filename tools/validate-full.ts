import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { run, type EngineData, type EngineResult } from '../packages/domain/src/index.js';
import type { AnalyticsProfile } from '../packages/shared/src/index.js';
import { withTenant } from '../apps/server/src/kernel/index.js';
import {
  loadEngineData,
  readProfile,
  runForTenant,
  servedRun,
} from '../apps/server/src/modules/analytics/index.js';
import { plantToday } from '../apps/server/src/modules/plant/index.js';
import { connect, type Tenant } from '../apps/server/src/seed/legacy-load.js';
import {
  checkCoverage,
  checkRun,
  checkStable,
  checkYears,
  explainedBy,
  hashOf,
  parseAllowlist,
  type Diff,
  type FigureRow,
} from './validate-checks.js';

/**
 * `pnpm validate:full --tenant <slug> [--as-of YYYY-MM-DD] [--allowlist <file>] [--allow-remote]` (ticket 79, D34).
 * Reads the whole database on `DATABASE_URL` (the app role; a local host unless `--allow-remote`), loads the engine
 * data through the real loader, runs the engine over the whole span and per year, and checks every registry figure:
 * it computes, its drill sums to it, a second run is identical, the kept run equals a fresh one, the years add up
 * to the whole, and every ticket is read by some figure. Prints counts, figure keys and ticket refs only. Exit 1
 * while any difference is not listed with a cause in `docs/plan/validate-explained.md`.
 */
const USAGE =
  'usage: validate:full --tenant <slug> [--as-of YYYY-MM-DD] [--allowlist <file>] [--allow-remote]';
const DEFAULT_ALLOWLIST = fileURLToPath(
  new URL('../docs/plan/validate-explained.md', import.meta.url),
);
const LISTED_REFS = 25;

export interface Report {
  lines: string[];
  unexplained: Diff[];
  explained: (Diff & { cause: string })[];
}

/** A test seam: the engine, so a mutation test can hand the checks a figure that is one row short. */
export type Engine = typeof run;

interface Loaded {
  data: EngineData;
  profile: AnalyticsProfile;
  asOf: string;
  tickets: number;
}

async function load(pool: Pool, tenant: Tenant, asOf?: string): Promise<Loaded> {
  return withTenant(pool, tenant.id, async (tx) => {
    const data = await loadEngineData(tx, tenant.id);
    const count = await tx.query('SELECT count(*)::int AS n FROM ticket');
    return {
      data,
      profile: await readProfile(tx, tenant.id),
      asOf: asOf ?? (await plantToday(tx, tenant.id, new Date())),
      tickets: (count.rows[0] as { n: number }).n,
    };
  });
}

class Rolled extends Error {
  constructor(readonly diffs: Diff[]) {
    super('rolled back');
  }
}

/** The run a reader is served (computed, kept, read back) equals a fresh compute; the kept copy is rolled back. */
async function checkServed(pool: Pool, tenant: Tenant, asOf: string): Promise<Diff[]> {
  try {
    await withTenant(pool, tenant.id, async (tx) => {
      const compute = () => runForTenant(tx, { tenantId: tenant.id, asOf });
      const kept = await servedRun(tx, { tenantId: tenant.id, asOf, compute });
      const served = await servedRun(tx, { tenantId: tenant.id, asOf, compute });
      const fresh = hashOf(await compute());
      const diffs: Diff[] = [];
      if (hashOf(kept) !== fresh)
        diffs.push({ id: 'stable:served:kept', text: 'the kept run differs from a fresh compute' });
      if (hashOf(served) !== fresh)
        diffs.push({
          id: 'stable:served:read',
          text: 'the run served on a second read differs from a fresh compute',
        });
      throw new Rolled(diffs);
    });
  } catch (error) {
    if (error instanceof Rolled) return error.diffs;
    throw error;
  }
  return [];
}

/** The calendar years from the plant's first record to the run date. */
function yearsOf(data: EngineData, asOf: string): number[] {
  const first = [
    ...data.reports.map((report) => report.date),
    ...[...data.tickets, ...data.tasks].map((ticket) => ticket.reportedAt),
  ]
    .map((day) => Number(day.slice(0, 4)))
    .reduce((least, year) => Math.min(least, year), Number(asOf.slice(0, 4)));
  return Array.from({ length: Number(asOf.slice(0, 4)) - first + 1 }, (_, at) => first + at);
}

const timed = <T>(work: () => T): { out: T; ms: number } => {
  const start = Date.now();
  return { out: work(), ms: Date.now() - start };
};

interface Pass {
  whole: EngineResult;
  years: EngineResult[];
  lines: string[];
}

/** The engine over the whole span and over each year, each with its time and hash. */
function runAll(engine: Engine, input: Loaded, years: readonly number[]): Pass {
  const { data, profile, asOf } = input;
  const lines: string[] = [];
  const span = (from: string, to: string) => {
    const done = timed(() => engine(data, to < asOf ? to : asOf, profile, { from, to }));
    lines.push(
      `run ${from}..${to}: ${done.ms} ms, hash ${hashOf(done.out)}, ${done.out.figures.length} figures`,
    );
    return done.out;
  };
  const whole = span(`${years[0]}-01-01`, asOf);
  return { whole, years: years.map((year) => span(`${year}-01-01`, `${year}-12-31`)), lines };
}

function tableOf(rows: readonly FigureRow[], bad: ReadonlyMap<string, string[]>): string[] {
  const head = `${'figure'.padEnd(34)} ${'state'.padEnd(17)} ${'drill rows'.padStart(10)}  ${'identity'.padEnd(8)} ${'stable'.padEnd(6)} years`;
  const flag = (key: string, kind: string): string =>
    bad.get(key)?.includes(kind) ? 'DIFF' : 'ok';
  return [
    head,
    ...rows.map(
      (row) =>
        `${row.key.padEnd(34)} ${row.state.padEnd(17)} ${String(row.drill).padStart(10)}  ${row.identity.padEnd(8)} ${flag(row.key, 'stable').padEnd(6)} ${flag(row.key, 'years')}`,
    ),
  ];
}

interface Gathered {
  first: Loaded;
  years: number[];
  pass: Pass;
  second: Pass;
  stable: Diff[];
  whole: ReturnType<typeof checkRun>;
  coverage: ReturnType<typeof checkCoverage>;
  diffs: Diff[];
}

/** Every run and every check; nothing here decides what is explained. */
async function gather(pool: Pool, tenant: Tenant, options: Options): Promise<Gathered> {
  const engine = options.engine ?? run;
  const first = await load(pool, tenant, options.asOf);
  const years = yearsOf(first.data, first.asOf);
  const pass = runAll(engine, first, years);
  // A second load and run: the same figures again, whatever the loader or the engine caches between them.
  const second = runAll(engine, await load(pool, tenant, first.asOf), years);
  const stable = checkStable('whole', pass.whole, second.whole);
  const whole = checkRun('whole', pass.whole, first.data);
  const perYear = pass.years.map((result, at) => checkRun(String(years[at]), result, first.data));
  const coverage = checkCoverage(first.data, pass.whole, first.tickets);
  const diffs = [
    ...whole.diffs,
    ...perYear.flatMap((r) => r.diffs),
    ...stable,
    ...checkYears(pass.whole, pass.years),
    ...(await checkServed(pool, tenant, first.asOf)),
    ...coverage.diffs,
  ];
  return { first, years, pass, second, stable, whole, coverage, diffs };
}

/** The figure keys the table marks DIFF in the stable and years columns. */
function badColumns(diffs: readonly Diff[]): Map<string, string[]> {
  const bad = new Map<string, string[]>();
  for (const diff of diffs) {
    const [kind, ...rest] = diff.id.split(':');
    if (kind !== 'years' && kind !== 'stable') continue;
    const key = rest.at(-1)!;
    bad.set(key, [...(bad.get(key) ?? []), kind]);
  }
  return bad;
}

function render(g: Gathered, report: Report): string[] {
  const { first, years, coverage } = g;
  const unread = coverage.diffs.filter((diff) => diff.id !== 'coverage:loader');
  const percent = coverage.total === 0 ? 100 : (coverage.read / coverage.total) * 100;
  const shown = report.unexplained.filter(
    (diff) => !diff.id.startsWith('coverage:') || diff.id === 'coverage:loader',
  );
  return [
    `validate:full as of ${first.asOf}, years ${years[0]}..${years.at(-1)}`,
    `database: ${coverage.inDatabase} tickets (${coverage.total} reported on or before ${first.asOf}), ${first.data.machines.length} machines, ${first.data.reports.length} reports`,
    ...g.pass.lines,
    `second load and run: ${g.second.whole.figures.length} figures, ${g.stable.length} differ from the first`,
    ...tableOf(g.whole.rows, badColumns(g.diffs)),
    `coverage: ${coverage.read} of ${coverage.total} tickets reported on or before ${first.asOf} read by a figure (${percent.toFixed(1)} %), ${unread.length} unread`,
    ...unread.slice(0, LISTED_REFS).map((diff) => `  unread: ${diff.text}`),
    ...(unread.length > LISTED_REFS ? [`  ... ${unread.length - LISTED_REFS} more unread`] : []),
    ...report.explained.map((d) => `explained: ${d.id} (${d.cause})`),
    report.unexplained.length === 0
      ? '0 unexplained differences'
      : `${report.unexplained.length} unexplained differences:`,
    ...shown.map((diff) => `  ${diff.id}: ${diff.text}`),
  ];
}

export interface Options {
  asOf?: string;
  allowlist?: string;
  engine?: Engine;
}

export async function validate(pool: Pool, tenant: Tenant, options: Options = {}): Promise<Report> {
  const g = await gather(pool, tenant, options);
  const allow = parseAllowlist(options.allowlist ?? '');
  const report: Report = { lines: [], unexplained: [], explained: [] };
  for (const diff of g.diffs) {
    const cause = explainedBy(diff, allow);
    if (cause === null) report.unexplained.push(diff);
    else report.explained.push({ ...diff, cause });
  }
  report.lines = render(g, report);
  return report;
}

function valueOf(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at < 0 ? undefined : argv[at + 1];
}

export async function main(argv = process.argv.slice(2)): Promise<Report> {
  const slug = valueOf(argv, '--tenant');
  const url = process.env.DATABASE_URL;
  if (!slug || !url) throw new Error(`${USAGE}\nDATABASE_URL is required`);
  const asOf = valueOf(argv, '--as-of');
  if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(USAGE);
  const file = valueOf(argv, '--allowlist') ?? DEFAULT_ALLOWLIST;
  const { pool, tenant } = await connect(url, slug, argv.includes('--allow-remote'));
  try {
    const report = await validate(pool, tenant, { asOf, allowlist: readFileSync(file, 'utf8') });
    console.log(report.lines.join('\n'));
    if (report.unexplained.length > 0) process.exitCode = 1;
    return report;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
