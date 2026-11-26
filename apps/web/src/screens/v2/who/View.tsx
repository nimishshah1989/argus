import type { ReactElement } from 'react';

/**
 * S19 "Who is using this phone" (`/who`) on the v2 kit (ADR 0051), laid out like `sign-in/View.tsx`: brand header,
 * card, step "2 of 2"; "Signed in as" + the shared-phone line; "Your name" select of `whoChoices(...)`; Continue calls
 * `actAs` and goes to `landingPath(role)`; "Sign in" (back) opens `SignOutSheet`. Words: the `signin.*` keys v1 used.
 */
export function WhoView(): ReactElement {
  throw new Error('not implemented');
}
