import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { PUBLIC_ROUTES, isPublicRoute, routeTable } from '../src/kernel/index.js';

type App = Awaited<ReturnType<typeof buildApp>>;

const queries: string[] = [];
const pool = {
  query: async (text: string) => {
    queries.push(text);
    return { rows: [], rowCount: 0 };
  },
} as unknown as Pool;
const UUID = '00000000-0000-4000-8000-000000000000';
const fill = (url: string) => url.replace(/:[A-Za-z]+/g, UUID);
const build = (rateLimitMax: number) =>
  buildApp({
    pool,
    logger: false,
    jobBoss: { getQueue: async () => ({}) } as unknown as PgBoss,
    rateLimitMax,
  });

let app: App;
let protectedRoutes: ReturnType<typeof routeTable>;

beforeAll(async () => {
  app = await build(100000);
  await app.ready();
  protectedRoutes = routeTable(app).filter((r) => !isPublicRoute(r.method, r.url));
});
afterAll(() => app.close());

describe('auth guard', () => {
  it('answers 401 on every route not on the public allowlist without a session', async () => {
    const before = queries.length;
    const wrong: string[] = [];
    for (const { method, url } of protectedRoutes) {
      const res = await app.inject({ method: method as 'GET', url: fill(url) });
      const code = method === 'HEAD' ? 'unauthenticated' : res.json().error?.code;
      if (res.statusCode !== 401 || code !== 'unauthenticated')
        wrong.push(`${method} ${url} → ${res.statusCode}`);
    }
    expect(wrong).toEqual([]);
    expect(queries.length).toBe(before);
  });

  it('sees every registrar in the route table', () => {
    const keys = routeTable(app).map((r) => `${r.method} ${r.url}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        'GET /api/v1/auth/me',
        'GET /api/v1/config',
        'PUT /api/v1/settings/sla-policies',
        'GET /api/v1/state',
        'POST /api/v1/tickets',
        'GET /api/v1/reports/day.pdf',
        'GET /api/v1/push/key',
        'HEAD /api/v1/auth/me',
      ]),
    );
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });

  it('registers no tag route', () => {
    expect(routeTable(app).filter((r) => r.url.includes('/tags'))).toEqual([]);
  });

  it("answers 401 'Your sign-in has ended' for a token with no session", async () => {
    const before = queries.length;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer fake-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      error: {
        code: 'unauthenticated',
        message: 'Your sign-in has ended. Please sign in again.',
      },
    });
    expect(queries.slice(before)).toEqual(['SELECT * FROM auth_lookup($1)']);
  });

  it('does not stop the public routes', async () => {
    expect([...PUBLIC_ROUTES].sort()).toEqual([
      'GET /api/v1/brand',
      'GET /api/v1/health',
      'POST /api/v1/auth/login',
    ]);
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect((await app.inject({ method: 'HEAD', url: '/api/v1/health' })).statusCode).toBe(200);
    const brand = await app.inject({
      method: 'GET',
      url: '/api/v1/brand',
      headers: { host: 'cosmos.localhost' },
    });
    expect(brand.statusCode).toBe(404);
    expect(brand.json().error.code).toBe('not_found');
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} });
    expect(login.statusCode).toBe(422);
    expect(login.json().error.code).toBe('validation');
  });

  it('answers 404, not 401, for an unknown route', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/nope' })).statusCode).toBe(404);
  });

  it('still rate-limits before the guard answers', async () => {
    const limited = await build(1);
    try {
      await limited.ready();
      const get = () => limited.inject({ method: 'GET', url: '/api/v1/auth/me' });
      expect((await get()).statusCode).toBe(401);
      const second = await get();
      expect(second.statusCode).toBe(429);
      expect(second.json().error.code).toBe('rate_limited');
    } finally {
      await limited.close();
    }
  });
});
