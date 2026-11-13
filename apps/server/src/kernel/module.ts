import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { JobsHandle } from './jobs.js';

export interface AppConfig {
  pool: Pool;
  logger?: boolean;
  rateLimitMax?: number;
  /** Local storage root for rendered files; S3 replaces this adapter later. */
  filesDir?: string;
  /** Chromium binary for PDF rendering; defaults to CHROMIUM_PATH or the E2E browsers. */
  chromiumPath?: string;
  /** Set by production startup; tests create a producer-only boss lazily. */
  databaseUrl?: string;
  jobBoss?: PgBoss;
  jobsHandle?: JobsHandle;
}

export interface ModuleDefinition {
  readonly name: string;
  readonly register: (app: FastifyInstance, config: AppConfig) => void;
}

export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}
