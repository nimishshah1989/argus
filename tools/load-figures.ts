import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { buildApp } from '../apps/server/src/app.js';
import { withTenant } from '../apps/server/src/kernel/index.js';
import { hashPassword } from '../apps/server/src/modules/identity/index.js';
import { plantToday } from '../apps/server/src/modules/plant/index.js';
import {
  engineRunsInRead,
  resetEngineRunsInRead,
  warmServedRun,
} from '../apps/server/src/modules/analytics/served.js';
import { assertLocalUrl } from '../apps/server/src/seed/legacy-load.js';
import { startTestDb } from '../apps/server/test/harness.js';

/**
 * `pnpm load:figures [--readers 30] [--seconds 60] [--years 5] [--tickets-per-year 1350] [--database-url <url> --allow-remote]`
 * (ticket 607, M3 goal G3.2): proves "a figures request answers in <=300 ms p95 with the whole history and 30
 * readers; 0 engine runs inside a read" (ADR 0024).
 *
 * Without `--database-url` it starts a Testcontainers Postgres, migrates it and seeds an invented plant (no real
 * data) with `years` years of tickets, `ticketsPerYear` a year. With one it uses that database (a local host unless
 * `--allow-remote`, the same guard as `tools/validate-full.ts`). It then starts the API in-process, reads the figures
 * once to warm, and runs `readers` concurrent readers for `seconds` on GET /api/v1/analytics/figures (and the board
 * read if the app has one), with plain `fetch`. It prints requests, errors, p50, p95, max (ms) and the engine runs
 * counted inside reads, and exits 1 when p95 is over 300 ms, any request failed, or any engine ran inside a read.
 */

/** The p95 ceiling of goal G3.2, in milliseconds. */
export const P95_LIMIT_MS = 300;

export interface LoadOptions {
  /** Use this database instead of starting a container. */
  databaseUrl?: string;
  /** Allow a non-local `databaseUrl`. */
  allowRemote?: boolean;
  /** Concurrent readers. Default 30. */
  readers: number;
  /** Seconds the readers keep reading. Default 60. */
  seconds: number;
  /** Years of invented history. Default 5. */
  years: number;
  /** Tickets per year in the invented plant. Default 1350. */
  ticketsPerYear: number;
}

export interface LoadReport {
  requests: number;
  errors: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** `engineRunsInRead()` after the warm-up reads; must be 0. */
  engineRunsInRead: number;
  /**
   * Ticket 628: each route read, on its own. `figures` is GET /api/v1/analytics/figures, `board` is
   * GET /api/v1/analytics/action-center. Each reader alternates the two (reader i starts on route i % 2), so both get
   * about half the requests. The top-level numbers are both routes together.
   */
  routes: Record<'figures' | 'board', RouteReport>;
}

/** Ticket 628: one route's share of a run. G3.2 needs each route answered, each with p95 <= `P95_LIMIT_MS`. */
export interface RouteReport {
  requests: number;
  errors: number;
  p95Ms: number;
}

/** Skeleton (ticket 628): replaced by the per-route numbers of `readAll`. */
function routesNotBuilt(): LoadReport['routes'] {
  throw new Error('not built: ticket 628');
}

/** What is wrong with a run, one plain sentence each; empty when it passes G3.2. */
export function problemsOf(report: LoadReport): string[] {
  const problems: string[] = [];
  if (report.requests === 0) problems.push('no request was answered');
  if (report.p95Ms > P95_LIMIT_MS)
    problems.push(`p95 ${report.p95Ms} ms is over the ${P95_LIMIT_MS} ms limit`);
  if (report.errors > 0) problems.push(`${report.errors} requests failed`);
  if (report.engineRunsInRead > 0)
    problems.push(`${report.engineRunsInRead} engine runs happened inside a read`);
  return problems;
}

const SLUG = 'load-plant';
const PASSWORD = 'load-test-password';
const MACHINES = 5;

/** An invented plant: one head login, a few machines, `years` of closed breakdowns ending today. */
async function seedPlant(admin: Pool, options: LoadOptions): Promise<string> {
  const tenant = randomUUID();
  const total = options.years * options.ticketsPerYear;
  const days = options.years * 365;
  const q = (text: string, params: unknown[] = []) => admin.query(text, params);
  await q("INSERT INTO tenant (id, slug, name) VALUES ($1, $2, 'Load plant')", [tenant, SLUG]);
  const person = await q(
    "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Load head', 'maintenance') RETURNING id",
    [tenant],
  );
  const passwordHash = await hashPassword(PASSWORD);
  await q(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'load-head', $3, 'plant_head', false)",
    [tenant, person.rows[0].id, passwordHash],
  );
  await q("INSERT INTO segment (tenant_id, code, name) VALUES ($1, 'CNC', 'CNC')", [tenant]);
  await q(
    `INSERT INTO machine (tenant_id, code, segment_id, cell)
     SELECT $1, 'LD-' || n, s.id, 'Cell-1' FROM generate_series(1, $2::int) n, segment s WHERE s.tenant_id = $1`,
    [tenant, MACHINES],
  );
  await q(
    "INSERT INTO shift (tenant_id, code, name, starts_at, ends_at) VALUES ($1, 'DAY', 'Day', '08:00', '18:30')",
    [tenant],
  );
  await q(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     SELECT $1, 'LD-' || n, 'stopped', 'closed', m.id, 'Invented fault',
            now() - make_interval(days => ($3::int * n / $2::int)), now() - make_interval(days => ($3::int * n / $2::int)),
            'backfill', 'S3'
       FROM generate_series(1, $2::int) n
       JOIN LATERAL (SELECT id FROM machine WHERE tenant_id = $1 ORDER BY code OFFSET (n % $4::int) LIMIT 1) m ON true`,
    [tenant, total, days, MACHINES],
  );
  await q(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     SELECT tenant_id, id, machine_id, reported_at::date, 'DAY', 'Invented fault', 30 + (length(ref) * 7) % 90, 'M'
       FROM ticket WHERE tenant_id = $1`,
    [tenant],
  );
  return tenant;
}

const at = (sorted: number[], share: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * share) - 1)] ?? 0;

/** The readers: each fetches until the deadline, timing every request; a non-2xx or a thrown fetch is an error. */
async function readAll(url: string, headers: Record<string, string>, options: LoadOptions) {
  const times: number[] = [];
  let errors = 0;
  const deadline = performance.now() + options.seconds * 1000;
  const reader = async () => {
    while (performance.now() < deadline) {
      const start = performance.now();
      try {
        const res = await fetch(url, { headers });
        await res.arrayBuffer();
        if (!res.ok) errors += 1;
      } catch {
        errors += 1;
      }
      times.push(performance.now() - start);
    }
  };
  await Promise.all(Array.from({ length: options.readers }, reader));
  return { sorted: times.sort((a, b) => a - b), errors };
}

export async function runLoad(options: LoadOptions): Promise<LoadReport> {
  if (options.databaseUrl) {
    assertLocalUrl(options.databaseUrl, options.allowRemote ?? false);
    // shortcut: the test harness only makes a fresh database on a local server, so a remote one is not reachable even with --allow-remote; upgrade when a staging plant must be measured.
    process.env.TEST_PG_URL = options.databaseUrl;
  }
  const db = await startTestDb();
  const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 1_000_000 });
  try {
    const tenant = await seedPlant(db.admin, options);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: `${SLUG}.localhost`, 'content-type': 'application/json' },
      payload: { username: 'load-head', password: PASSWORD },
    });
    if (login.statusCode !== 200) throw new Error(`login failed: ${login.statusCode}`);
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    // fetch ignores a Host header, so the plant is named in the URL (`*.localhost` is this machine).
    const origin = base.replace('127.0.0.1', `${SLUG}.localhost`);
    const headers = { authorization: `Bearer ${login.json().token}` };
    const asOf = await withTenant(db.app, tenant, (tx) => plantToday(tx, tenant, new Date()));
    await warmServedRun(db.app, { tenantId: tenant, asOf });
    resetEngineRunsInRead();
    const url = `${origin}/api/v1/analytics/figures`;
    const warm = await fetch(url, { headers });
    if (!warm.ok) throw new Error(`warm-up read failed: ${warm.status}`);
    await warm.arrayBuffer();
    const { sorted, errors } = await readAll(url, headers, options);
    return {
      requests: sorted.length,
      errors,
      p50Ms: Math.round(at(sorted, 0.5)),
      p95Ms: Math.round(at(sorted, 0.95)),
      maxMs: Math.round(sorted.at(-1) ?? 0),
      engineRunsInRead: engineRunsInRead(),
      routes: routesNotBuilt(),
    };
  } finally {
    await app.close();
    await db.stop();
  }
}

function numberOf(argv: readonly string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} needs a whole number >= 1`);
  return value;
}

export async function main(argv = process.argv.slice(2)): Promise<LoadReport> {
  const index = argv.indexOf('--database-url');
  const report = await runLoad({
    databaseUrl: index < 0 ? undefined : argv[index + 1],
    allowRemote: argv.includes('--allow-remote'),
    readers: numberOf(argv, '--readers', 30),
    seconds: numberOf(argv, '--seconds', 60),
    years: numberOf(argv, '--years', 5),
    ticketsPerYear: numberOf(argv, '--tickets-per-year', 1350),
  });
  console.log(
    `requests ${report.requests}, errors ${report.errors}, p50 ${report.p50Ms} ms, p95 ${report.p95Ms} ms, max ${report.maxMs} ms, engine runs in reads ${report.engineRunsInRead}`,
  );
  const problems = problemsOf(report);
  for (const problem of problems) console.log(`FAIL: ${problem}`);
  if (problems.length > 0) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit())
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
