// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { login, person } from '../settings-people/fixture-rows.js';
import { loginsTakeaway, peopleTakeaway } from '../settings-people/model.js';

describe('S26-4 people and logins: edges', () => {
  it('is null on empty lists', () => {
    expect(peopleTakeaway([])).toBeNull();
    expect(loginsTakeaway([])).toBeNull();
  });

  it('leaves inactive rows out and reads a blank phone as no phone', () => {
    expect(peopleTakeaway([person('off', null, false), person('blank', '  ')])).toEqual({
      total: 1,
      noPhone: 1,
    });
    expect(loginsTakeaway([login('off', true, false), login('me', false)])).toEqual({
      total: 1,
      shared: 0,
    });
  });
});
