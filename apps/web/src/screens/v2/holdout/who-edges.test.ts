// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api.js';
import { whoChoices, whoError } from '../who/model.js';

describe('S19 who is using this phone: edges', () => {
  it('does not reorder the list it was given, and keeps an empty list empty', () => {
    const people = [
      { id: 'b', name: 'Zeel' },
      { id: 'a', name: 'Bhavin' },
    ];
    expect(whoChoices(people).map((p) => p.id)).toEqual(['a', 'b']);
    expect(people.map((p) => p.id)).toEqual(['b', 'a']);
    expect(whoChoices([])).toEqual([]);
  });

  it('a refusal on another field is not "choose a name"', () => {
    expect(whoError(new ApiError('validation', 'x', 'password'))).toBeNull();
    expect(whoError(undefined)).toBeNull();
  });

  it('/who renders the v2 screen and the v1 page is gone', () => {
    const app = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8');
    expect(app).not.toMatch(/faces\/signin\/who/);
    expect(app).toMatch(/screens\/v2\/who\/View/);
    expect(() => readFileSync(new URL('../../../faces/signin/who.tsx', import.meta.url))).toThrow();
  });
});
