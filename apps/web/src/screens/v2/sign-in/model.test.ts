// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api.js';
import { nextPath, readyToSignIn, signInError } from './model.js';

const api = (code: string) => new ApiError(code, 'x');

describe('S19 sign-in model', () => {
  it('says what went wrong in v1’s words', () => {
    expect(signInError(new TypeError('Failed to fetch'))).toBe('signin.unreachable');
    expect(signInError(api('rate_limited'))).toBe('signin.tooMany');
    expect(signInError(api('not_found'))).toBe('signin.unknownCompany');
    expect(signInError(api('internal'))).toBe('signin.serverProblem');
    expect(signInError(api('unauthenticated'))).toBe('login.failed');
  });

  it('is ready with a username and a password, and trims only the username', () => {
    expect(readyToSignIn('asha', 'pw')).toBe(true);
    expect(readyToSignIn('   ', 'pw')).toBe(false);
    expect(readyToSignIn('asha', '')).toBe(false);
    expect(readyToSignIn('asha', ' ')).toBe(true);
  });

  it('sends each role to its landing page', () => {
    expect(nextPath({ role: 'head', shared: false }, false)).toBe('/analytics/today');
    expect(nextPath({ role: 'operator', shared: false }, false)).toBe('/floor/mine');
  });

  it('asks who is acting on a shared login with nobody acting', () => {
    expect(nextPath({ role: 'operator', shared: true, actingPersonId: null }, false)).toBe('/who');
  });
});
