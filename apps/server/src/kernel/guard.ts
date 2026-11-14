import type { FastifyInstance, FastifyRequest, preParsingAsyncHookHandler } from 'fastify';
import { apiError } from '@uptimo/shared';
import type { AuthContext } from './context.js';
import type { Refusal } from './contract.js';
import { bindLog } from './logging.js';

export const AUTH_MESSAGES = {
  missing: 'Missing bearer token',
  ended: 'Your sign-in has ended. Please sign in again.',
} as const;

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'GET /api/v1/health',
  'GET /api/v1/brand',
  'GET /api/v1/brand/logo',
  'POST /api/v1/auth/login',
]);

/** What a login that still has its temporary password may do: see who it is, change it, sign out. */
const PASSWORD_SCREENS: ReadonlySet<string> = new Set([
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/password',
  'POST /api/v1/auth/logout',
]);

/**
 * What a shared phone with nobody acting on it may still do: say who it is, list the people to choose from,
 * choose, drop its push registration, sign out. Everything else waits until the app has asked who is using it.
 */
const PICKER_SCREENS: ReadonlySet<string> = new Set([
  'GET /api/v1/auth/me',
  'GET /api/v1/config',
  'POST /api/v1/auth/acting',
  'POST /api/v1/push/unsubscribe',
  'POST /api/v1/auth/logout',
]);

const needsActingPerson = (auth: AuthContext, screen: string): boolean =>
  auth.shared && auth.personId === null && !PICKER_SCREENS.has(screen);

/** Whether this customer makes a login with a temporary password change it before anything else. */
export type PasswordChangeRequired = (auth: AuthContext) => Promise<boolean>;

export interface RouteKey {
  method: string;
  url: string;
}

/** The header a call by our own support staff carries: the grant it is made under (D27). */
const SUPPORT_GRANT_HEADER = 'x-support-grant';

/** What the guard knows about a call that names a support grant, so each one can be judged and written down. */
export interface SupportCall {
  grantId: string;
  method: string;
  /** The route as registered (`/api/v1/people/:id`), never the address asked for. */
  route: string;
  ip: string;
}

/**
 * `host` is the request's Host header: a session is only good on its own customer's host. `support` is set
 * when the call names a support grant. Answers who is calling, null (401), or a refusal to send as it is.
 */
export type Authenticate = (
  token: string,
  host: string,
  support?: SupportCall,
) => Promise<AuthContext | Refusal | null>;

function supportCallOf(request: FastifyRequest): SupportCall | undefined {
  const grant = request.headers[SUPPORT_GRANT_HEADER];
  if (grant === undefined) return undefined;
  return {
    grantId: String(grant),
    method: request.method,
    route: request.routeOptions.url ?? '',
    ip: request.ip,
  };
}

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
export function registerAuthGuard(
  app: FastifyInstance,
  authenticate: Authenticate,
  enforcePasswordChange?: PasswordChangeRequired,
): void {
  const table: RouteKey[] = [];
  tables.set(app, table);
  app.decorateRequest('auth', null);
  const guard: preParsingAsyncHookHandler = async (request, reply, payload) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.missing));
    const auth = await authenticate(token, request.headers.host ?? '', supportCallOf(request));
    if (!auth) return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.ended));
    if ('status' in auth) return reply.code(auth.status).send(auth.body);
    request.auth = auth;
    bindLog(request, reply, { tenantId: auth.tenantId, loginId: auth.loginId });
    const screen = `${request.method} ${request.routeOptions.url}`;
    if (needsActingPerson(auth, screen))
      return reply
        .code(403)
        .send(apiError('choose_acting_person', 'Choose who is using this phone to continue'));
    if (
      auth.mustChangePassword &&
      !PASSWORD_SCREENS.has(screen) &&
      (await enforcePasswordChange?.(auth))
    )
      return reply
        .code(403)
        .send(apiError('must_change_password', 'Change your temporary password to continue'));
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
