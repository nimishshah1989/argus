import type { MessageKey } from '@uptimo/shared/i18n';
import { ApiError } from '../../../api.js';

/** The shortest new password the screen lets you save (v1's `MIN_LENGTH`). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The server's refusals in the catalogue's words, exactly v1's `refusal()` in `faces/signin/password.tsx`: not an
 * `ApiError` → null; code `unauthenticated` or field `old` → `signin.wrongPassword`; code `rate_limited` →
 * `signin.tooMany`; field `password` → `signin.weakPassword`; anything else → null (the caller rethrows it).
 */
export function passwordRefusal(error: unknown): MessageKey | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'unauthenticated' || error.field === 'old') return 'signin.wrongPassword';
  if (error.code === 'rate_limited') return 'signin.tooMany';
  if (error.field === 'password') return 'signin.weakPassword';
  return null;
}

/** Save may be pressed: a current password, a new one of at least `MIN_PASSWORD_LENGTH`, typed the same twice. */
export function passwordReady(old: string, next: string, repeat: string): boolean {
  return Boolean(old) && next.length >= MIN_PASSWORD_LENGTH && next === repeat;
}
