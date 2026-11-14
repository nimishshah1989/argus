/**
 * The API's rate limits (60 sign-in requests and 1000 calls a minute per sender) are fixed in production.
 * Only the e2e stack, which sets NODE_ENV=test, may raise them with E2E_RATE_LIMIT_MAX: its single
 * browser sends far more sign-ins from one address than any real sender. Production runs with
 * NODE_ENV=production (server.Dockerfile, docker-compose), so the variable does nothing there.
 */
export function rateLimitFromEnv(env: Record<string, string | undefined>): number | undefined {
  if (env.NODE_ENV !== 'test') return undefined;
  const max = Number(env.E2E_RATE_LIMIT_MAX);
  return Number.isInteger(max) && max > 0 ? max : undefined;
}
