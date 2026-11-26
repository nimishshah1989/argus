import type { MessageKey } from '@uptimo/shared/i18n';

/** The shortest new password the screen lets you save (v1's `MIN_LENGTH`). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The server's refusals in the catalogue's words, exactly v1's `refusal()` in `faces/signin/password.tsx`: not an
 * `ApiError` → null; code `unauthenticated` or field `old` → `signin.wrongPassword`; code `rate_limited` →
 * `signin.tooMany`; field `password` → `signin.weakPassword`; anything else → null (the caller rethrows it).
 */
export function passwordRefusal(error: unknown): MessageKey | null {
  void error;
  throw new Error('not implemented');
}

/** Save may be pressed: a current password, a new one of at least `MIN_PASSWORD_LENGTH`, typed the same twice. */
export function passwordReady(old: string, next: string, repeat: string): boolean {
  void [old, next, repeat];
  throw new Error('not implemented');
}
