// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextPath, signInError } from '../sign-in/model.js';

describe('S19 sign-in: edges', () => {
  it('a shared login that must change its password stays put (the data layer opens /password)', () => {
    expect(nextPath({ role: 'operator', shared: true }, true)).toBeNull();
  });

  it('a shared login with someone already acting goes to the landing page, not /who', () => {
    expect(nextPath({ role: 'technician', shared: true, actingPersonId: 'p1' }, false)).toBe(
      '/desk/mine',
    );
  });

  it('a thrown string or nothing at all reads as unreachable', () => {
    expect(signInError('boom')).toBe('signin.unreachable');
    expect(signInError(undefined)).toBe('signin.unreachable');
  });
});
