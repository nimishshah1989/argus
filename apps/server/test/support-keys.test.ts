import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { parseSupportKeys } from '../src/modules/identity/index.js';
import { keyHash, newKey, NO_SUCH } from './support-harness.js';

const one = keyHash(newKey());
const two = keyHash(newKey());

describe('SUPPORT_KEYS', () => {
  it('is empty when unset or blank: nobody has support access', () => {
    for (const raw of [undefined, '', '  ', ',']) expect(parseSupportKeys(raw).size).toBe(0);
  });

  it('reads name:hash pairs, forgiving spaces and upper-case hex', () => {
    const keys = parseSupportKeys(` dev-one:${one} , dev-two:${two.toUpperCase()}`);
    expect([...keys]).toEqual([
      ['dev-one', one],
      ['dev-two', two],
    ]);
  });

  it.each([
    ['a name with no hash', () => 'dev-one'],
    ['a hash that is too short', () => `dev-one:${one.slice(0, 40)}`],
    ['a key in place of its hash', () => `dev-one:${newKey()}`],
    ['no name', () => `:${one}`],
    ['a name used twice', () => `dev-one:${one},dev-one:${two}`],
    ['one key under two names', () => `dev-one:${one},dev-two:${one}`],
  ])('stops the server on %s, without repeating the value', (_what, raw) => {
    const value = raw();
    let message = '';
    try {
      parseSupportKeys(value);
    } catch (error) {
      ({ message } = error as Error);
    }
    expect(message).toMatch(/^SUPPORT_KEYS: /);
    expect(message).not.toContain(one);
    expect(message).not.toContain(value);
  });
});

describe('a server with no support keys', () => {
  it('answers 401 to any key, and asks the database nothing', async () => {
    const queries: string[] = [];
    const pool = {
      query: async (text: string) => {
        queries.push(text);
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;
    const app = await buildApp({
      pool,
      logger: false,
      jobBoss: { getQueue: async () => ({}) } as unknown as PgBoss,
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/people',
        headers: {
          host: 'cosmos.localhost',
          authorization: `Bearer ${newKey()}`,
          'x-support-grant': NO_SUCH,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
      expect(queries).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
