import { describe, expect, it } from 'vitest';
import { assertLocalServer } from './harness.js';

describe('TEST_PG_URL guard', () => {
  it.each([
    'postgresql://u@localhost:5432/postgres',
    'postgresql://u@127.0.0.1:5434/x',
    'postgresql://u@[::1]:5432/x',
  ])('accepts %s', (url) => expect(() => assertLocalServer(url)).not.toThrow());
  it.each([
    'postgresql://u@db.staging.example.com:5432/x',
    'postgresql://u@10.0.0.5/x',
    'not a url',
  ])('refuses %s', (url) => expect(() => assertLocalServer(url)).toThrow(/TEST_PG_URL/));
});
