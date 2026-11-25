import type { MessageKey } from '@uptimo/shared/i18n';

/** Who signed in, as far as where they go next is concerned. */
export type SignedIn = { role: string; shared: boolean; actingPersonId?: string | null };

/**
 * What the screen says when sign-in fails: no reply at all (not an `ApiError`) is `signin.unreachable`; `rate_limited`
 * is `signin.tooMany`; `not_found` is `signin.unknownCompany`; `internal` is `signin.serverProblem`; anything else is
 * `login.failed` (a wrong username or password). Moved unchanged from v1 `faces/signin/parts.tsx`.
 */
export function signInError(error: unknown): MessageKey {
  void error;
  throw new Error('not implemented');
}

/** Sign in may be pressed: a username that is not blank once trimmed, and any password (passwords are never trimmed). */
export function readyToSignIn(username: string, password: string): boolean {
  void [username, password];
  throw new Error('not implemented');
}

/**
 * Where a successful sign-in goes. A shared login with nobody acting asks "Who is using this phone?" (`/who`), unless
 * the login must change its temporary password first: then null (stay; the data layer opens `/password`). Everyone
 * else goes to their role's landing page (`landingPath` in `roles.ts`).
 */
export function nextPath(user: SignedIn, mustChangePassword: boolean): string | null {
  void [user, mustChangePassword];
  throw new Error('not implemented');
}
