import type { AppConfig } from './module.js';

/**
 * The per-client request cap for routes an unsigned visitor can reach (sign-in, company name, logo):
 * tighter than the whole API's. An explicit `rateLimitMax` overrides it, so tests and the E2E stack lift it.
 */
export function publicRouteCap(config: AppConfig) {
  return { rateLimit: { max: config.rateLimitMax ?? 60, timeWindow: '1 minute' } };
}
