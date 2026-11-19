import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { JobsHandle } from './jobs.js';
import type { Release } from './health.js';

export interface AppConfig {
  pool: Pool;
  logger?: FastifyServerOptions['logger'];
  rateLimitMax?: number;
  /** Where the plants' addresses live (`<slug>.<domain>`); links to the app are built from it, never from a Host header. */
  publicBaseDomain?: string;
  /** Local storage root for rendered files; S3 replaces this adapter later. */
  filesDir?: string;
  /** Chromium binary for PDF rendering; defaults to CHROMIUM_PATH or the E2E browsers. */
  chromiumPath?: string;
  /** Set by production startup; tests create a producer-only boss lazily. */
  databaseUrl?: string;
  /** The build this process runs (`releaseFromEnv`); `/api/v1/health` reports it. */
  release?: Release;
  jobBoss?: PgBoss;
  jobsHandle?: JobsHandle;
  /**
   * Our own support staff (D29): name → SHA-256 (hex) of that person's key. Only hashes are held, from
   * `SUPPORT_KEYS`. Absent or empty: nobody can use support access.
   */
  supportKeys?: ReadonlyMap<string, string>;
}

export interface ModuleDefinition {
  readonly name: string;
  readonly register: (app: FastifyInstance, config: AppConfig) => void;
}

export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}
