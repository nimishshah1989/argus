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
}

/** What is wrong with a run, one plain sentence each; empty when it passes G3.2. */
export function problemsOf(_report: LoadReport): string[] {
  throw new Error('not built');
}

export async function runLoad(_options: LoadOptions): Promise<LoadReport> {
  throw new Error('not built');
}

export async function main(_argv = process.argv.slice(2)): Promise<LoadReport> {
  throw new Error('not built');
}
