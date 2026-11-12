# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: `severity-matrix-implementation` now includes current `main`, including the synthetic importer
and configurable tags. M2-2.1 severity is implemented; its labelled PR and GitHub CI remain.

- `deriveSeverity` covers criticality × kind and general/urgent requests; `Ticket.severity` is non-null.
- Migration 0006 backs up/backfills legacy rows, seeds tenant matrices, enforces valid values, then makes
  severity NOT NULL; the report-time criticality snapshot stays immutable.
- Raise and importer derive severity. Correct, upgrade-kind and machine-criticality changes recalculate
  current severity while preserving that snapshot. Raise/criticality updates serialize safely.
- Settings API validates matrix and criticality bodies (admin/head); `/config` is the only web source.
- Web severity appears on cards/detail and `/desk/settings`, with loading, role gate, offline read-only,
  text contrast, 52px targets and accessible status messages.
- Post-merge verification: 426 tests / 43 files and 30 / 30 desktop-phone E2E, with independent reviews PASS.

## Live on main

- M0 foundation: forced RLS and `app_api`, auth, settings/config, Cosmos seed and walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b: report/PDF, live board, PWA/share, offline outbox, push, needs-report, day report, admin faces,
  Desk Views, exact cancel time and per-person minutes.
- M1b import (#69/#70): safe synthetic-only contract, reconciliation, security checks and undo.
- M2 configurable tags (#71): relational `ticket_tag`, forced RLS/cascade, tenant catalogue,
  `canWork`/idempotency/row-locked writes, actor-labelled history and accessible browser states.
- M1b gate evidence: 380 Vitest tests, 16 Playwright tests, full verification and R3 review.

## In flight

- `severity-matrix-implementation`: the labelled PR and GitHub CI are next.
- M2-2.2 SLA timers and timeline/history are separate branches, not part of this severity PR.
- Real N1 export/Worker schema, reviewed N12 aliases and cutover runbook remain external.

## Next

1. Require green GitHub CI and merge the severity PR.
2. Continue with M2-2.2 SLA timers on their separate branch.
3. Staging/production execution is not part of this session.
4. Real N1 compatibility/cutover remains external and requires human security sign-off.

## Blocked / external inputs

- N1 real export semantics, N11 real shifts, N12 older-set aliases, N5 Gujarati strings.
- AWS/domain/GitHub OIDC remain external; Terraform is authored but unapplied.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.
