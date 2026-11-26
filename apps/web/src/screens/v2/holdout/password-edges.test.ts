// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api.js';
import { passwordReady, passwordRefusal } from '../password/model.js';

describe('S19 change password: edges', () => {
  it('a 7-character password is never ready; 8 is', () => {
    expect(passwordReady('old', '1234567', '1234567')).toBe(false);
    expect(passwordReady('old', '12345678', '12345678')).toBe(true);
  });

  it('spaces count as characters and are not trimmed', () => {
    expect(passwordReady('old', '        ', '        ')).toBe(true);
    expect(passwordReady('old', 'abcdefgh ', 'abcdefgh')).toBe(false);
  });

  it('keeps v1’s order: wrong password, then rate limit, then the password field', () => {
    expect(passwordRefusal(new ApiError('unauthenticated', 'x', 'password'))).toBe(
      'signin.wrongPassword',
    );
    expect(passwordRefusal(new ApiError('rate_limited', 'x', 'password'))).toBe('signin.tooMany');
    expect(passwordRefusal(undefined)).toBeNull();
  });

  it('/password renders the v2 screen and the v1 page is gone', () => {
    const app = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8');
    expect(app).not.toMatch(/faces\/signin\/password/);
    expect(app).toMatch(/screens\/v2\/password\/View/);
    expect(() =>
      readFileSync(new URL('../../../faces/signin/password.tsx', import.meta.url)),
    ).toThrow();
  });
});
