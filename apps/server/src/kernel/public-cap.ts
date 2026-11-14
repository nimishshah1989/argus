import type { AppConfig } from './module.js';

/** Requests a minute one client may make to sign in. */
const SIGN_IN_PER_MINUTE = 60;

/** Read-only public routes (company name, logo) are loaded by every phone at shift start, often behind one address. */
export const PUBLIC_READ_PER_MINUTE = 300;

/**
 * The per-client request cap for routes an unsigned visitor can reach, tighter than the whole API's.
 * An explicit `rateLimitMax` overrides every cap, so tests and the E2E stack lift them.
 * "Client" is the address Fastify resolves from Caddy's X-Forwarded-For: this assumes Caddy is the only
 * proxy in front of the server, since a CDN or load balancer in front would make every visitor one client.
 */
export function publicRouteCap(config: AppConfig, perMinute = SIGN_IN_PER_MINUTE) {
  return { rateLimit: { max: config.rateLimitMax ?? perMinute, timeWindow: '1 minute' } };
}
