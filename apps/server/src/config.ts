import type { Pool } from 'pg';

export interface AppConfig {
  pool: Pool;
  logger?: boolean;
  rateLimitMax?: number;
}
