// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api.js';
import { passwordReady, passwordRefusal } from './model.js';

describe('S19 change password: model', () => {
  it('says what the server refused in v1’s words', () => {
    expect(passwordRefusal(new ApiError('unauthenticated', 'x'))).toBe('signin.wrongPassword');
    expect(passwordRefusal(new ApiError('validation', 'x', 'old'))).toBe('signin.wrongPassword');
    expect(passwordRefusal(new ApiError('rate_limited', 'x'))).toBe('signin.tooMany');
    expect(passwordRefusal(new ApiError('validation', 'x', 'password'))).toBe(
      'signin.weakPassword',
    );
  });

  it('leaves every other failure to the caller', () => {
    expect(passwordRefusal(new ApiError('internal', 'x'))).toBeNull();
    expect(passwordRefusal(new TypeError('Failed to fetch'))).toBeNull();
  });

  it('is ready with the current password and the same new one twice', () => {
    expect(passwordReady('old-pass', 'new-pass-1', 'new-pass-1')).toBe(true);
    expect(passwordReady('', 'new-pass-1', 'new-pass-1')).toBe(false);
    expect(passwordReady('old-pass', 'new-pass-1', 'new-pass-2')).toBe(false);
  });
});
