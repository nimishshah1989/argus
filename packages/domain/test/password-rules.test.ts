import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS, passwordProblem } from '../src/password-rules.js';

describe('passwordProblem', () => {
  it('accepts a password that is long enough, not common and not the username', () => {
    expect(passwordProblem('blue-tractor-pond-82', 'asha')).toBeNull();
  });

  it('refuses fewer than 8 characters', () => {
    expect(passwordProblem('x7!q', 'asha')).toBe('too_short');
  });

  it('refuses a common password whatever its letter case', () => {
    for (const weak of [
      'password',
      'Password',
      'PASSWORD',
      'qwertyuiop',
      '12345678',
      'Welcome1',
      '  password  ',
      'password\t',
    ])
      expect(passwordProblem(weak, 'asha'), weak).toBe('common');
  });

  it('refuses the usual disguises: punctuation, look-alike characters, spaces', () => {
    for (const weak of [
      'Admin@123',
      'Password@123',
      'Welcome@123',
      'India@123',
      'P@ssw0rd',
      'Passw0rd!',
      'p-a-s-s-w-o-r-d-1-2-3',
    ])
      expect(passwordProblem(weak, 'asha'), weak).toBe('common');
  });

  it('counts the length after trimming', () => {
    expect(passwordProblem('  ab12  ', 'asha')).toBe('too_short');
    expect(passwordProblem('        a', 'asha')).toBe('too_short');
  });

  it('accepts a long passphrase that merely contains a common word', () => {
    expect(passwordProblem('correct-horse-password-staple', 'asha')).toBeNull();
  });

  it('refuses the username, whatever its letter case', () => {
    expect(passwordProblem('Asha.Singh1', 'asha.singh1')).toBe('same_as_username');
    expect(passwordProblem('ashasingh1', 'asha.singh1')).toBe('same_as_username');
  });

  it('carries a list of a few hundred entries, each at least 8 characters, lower case, no duplicates', () => {
    expect(COMMON_PASSWORDS.length).toBeGreaterThan(300);
    expect(COMMON_PASSWORDS.every((p) => p.length >= 8 && p === p.toLowerCase())).toBe(true);
    expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
  });
});
