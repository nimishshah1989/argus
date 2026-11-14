import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { rateLimitFromEnv } from '../src/rate-limit-env.js';
import { startTestDb, type TestDb } from './harness.js';

describe('who may raise the API rate limits', () => {
  it('only the e2e stack (NODE_ENV=test) can, with E2E_RATE_LIMIT_MAX', () => {
    expect(rateLimitFromEnv({ NODE_ENV: 'test', E2E_RATE_LIMIT_MAX: '100000' })).toBe(100000);
  });

  it('production ignores it, whatever is set', () => {
    for (const NODE_ENV of ['production', undefined, 'development', ''])
      expect(rateLimitFromEnv({ NODE_ENV, E2E_RATE_LIMIT_MAX: '100000' })).toBeUndefined();
  });

  it('ignores a value that is not a positive whole number', () => {
    for (const E2E_RATE_LIMIT_MAX of [undefined, '', '0', '-5', '1.5', 'many'])
      expect(rateLimitFromEnv({ NODE_ENV: 'test', E2E_RATE_LIMIT_MAX })).toBeUndefined();
  });
});

describe('the login cap production runs with', () => {
  let db: TestDb;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    db = await startTestDb();
    // No rateLimitMax: exactly how apps/server/src/index.ts starts in production.
    app = await buildApp({ pool: db.app, logger: false, rateLimitMax: rateLimitFromEnv({}) });
  });
  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it('keeps 60 sign-in requests a minute for one sender, then answers 429', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: '203.0.113.9',
        headers: { host: 'cap.localhost', 'content-type': 'application/json' },
        payload: {},
      });
    for (let i = 0; i < 60; i++) expect((await attempt()).statusCode).toBe(422);
    expect((await attempt()).statusCode).toBe(429);
  });
});
