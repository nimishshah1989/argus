import type { FastifyInstance, preParsingAsyncHookHandler } from 'fastify';
import { apiError } from '@uptimo/shared';
import type { AuthContext } from './context.js';
import { bindLog } from './logging.js';

export const AUTH_MESSAGES = {
  missing: 'Missing bearer token',
  ended: 'Your sign-in has ended. Please sign in again.',
} as const;

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'GET /api/v1/health',
  'GET /api/v1/brand',
  'POST /api/v1/auth/login',
]);

export interface RouteKey {
  method: string;
  url: string;
}

export type Authenticate = (token: string) => Promise<AuthContext | null>;

const tables = new WeakMap<FastifyInstance, RouteKey[]>();

/** HEAD is looked up as its GET. */
export function isPublicRoute(method: string, url: string): boolean {
  return PUBLIC_ROUTES.has(`${method === 'HEAD' ? 'GET' : method} ${url}`);
}

export function bearerToken(authorization?: string): string | null {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function routeTable(app: FastifyInstance): readonly RouteKey[] {
  return tables.get(app) ?? [];
}

/**
 * Every route outside PUBLIC_ROUTES needs a session. A route-level preParsing hook runs after every
 * onRequest hook, so rate limiting still answers 429 before this answers 401, and unmatched URLs
 * (404) never reach it.
 */
export function registerAuthGuard(app: FastifyInstance, authenticate: Authenticate): void {
  const table: RouteKey[] = [];
  tables.set(app, table);
  app.decorateRequest('auth', null);
  const guard: preParsingAsyncHookHandler = async (request, reply, payload) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.missing));
    const auth = await authenticate(token);
    if (!auth) return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.ended));
    request.auth = auth;
    bindLog(request, reply, { tenantId: auth.tenantId, loginId: auth.loginId });
    return payload;
  };
  app.addHook('onRoute', (route) => {
    const methods = [route.method].flat();
    for (const method of methods) table.push({ method, url: route.url });
    const existing = [route.preParsing ?? []].flat();
    if (methods.some((m) => !isPublicRoute(m, route.url)) && !existing.includes(guard))
      route.preParsing = [...existing, guard];
  });
}
