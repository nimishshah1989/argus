# ADR 0005: axe Playwright checks for user-facing slices

## Context

New user-facing components need repeatable WCAG evidence, not only role and keyboard assertions.
The repository's quality bar names axe, but no axe adapter was installed. Adding a production
accessibility library would be unnecessary because the browser already renders native semantic HTML.

## Decision

Use `@axe-core/playwright` as a **development-only** dependency for real-stack browser tests. New
interactive surfaces assert zero serious/critical violations in their empty, selected, read-only and
error states. `axe-core` and the adapter are MPL-2.0, already permitted by `THIRD_PARTY.md`.

## Rejected

- Manual-only inspection: important states regress without a repeatable gate.
- A production accessibility runtime or component rewrite: adds bundle weight and dependencies without
  improving the native HTML already used.
- Treating every minor violation as a merge blocker: serious/critical is the actionable slice gate;
  lower-severity findings remain available for design review.

## Consequences

The root lockfile and dev dependency list change. No application runtime dependency or shipped bundle
is added. Each affected browser test must create its state through the public API/UI and run axe on the
real page. Future slices should reuse the adapter rather than adding another accessibility framework.
