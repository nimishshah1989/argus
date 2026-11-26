// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { login, person } from './fixture-rows.js';
import { loginsTakeaway, peopleTakeaway } from './model.js';

describe('S26-4 people and logins model', () => {
  it('counts people with no phone', () => {
    const rows = [person('a', null), person('b', '+91 00000 00000'), person('c', null)];
    expect(peopleTakeaway(rows)).toEqual({ total: 3, noPhone: 2 });
  });

  it('counts shared logins', () => {
    expect(loginsTakeaway([login('a', true), login('b', false)])).toEqual({ total: 2, shared: 1 });
  });
});
