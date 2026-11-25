# ADR 0038: Gates cut to the core

Date: 24 Nov 2026 · Decided by: Nimish ("yes 0038")

ADR 0037 made four paperwork checks warn. Screens still stalled on the rest. From now on these also warn instead of block: `format:check`, `parity`, `docs:check`, `audit:lean`, the ticket size budget, the per-PR handoff file and the `Screens:` line in the PR body.

Still blocking: typecheck, lint, tests, browser and gallery, `pii:scan`, gitleaks, licences, migrations, `ui:check`, and `loop-guard` for protected files, existing tests and screen approvals (a listed screen must still be approved). A screen PR may add its own line to `apps/web/src/screens/v2/insight-coverage.test.ts`.
