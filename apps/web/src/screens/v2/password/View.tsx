import type { ReactElement } from 'react';

/**
 * S19 "Change password" (`/password`) on the v2 kit (ADR 0051), laid out like `sign-in/View.tsx`: current / new /
 * repeat fields (`autoComplete` current-password / new-password); Save calls `changePassword`; then the "Password
 * saved" step with Continue to the landing; signed out → `<Navigate to="/login" replace />`. Words: v1's `signin.*`.
 */
export function PasswordView(): ReactElement {
  throw new Error('not implemented');
}
