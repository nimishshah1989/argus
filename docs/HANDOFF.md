# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: `import-integration` now includes current `main`, including the configurable-tag work.
The importer remains **synthetic-only** (`argus.synthetic-bhavin/v1`); real Bhavin/N1 exports are rejected.
No production execution or real compatibility claim is included.

- Strict contract/aliases, canonical identity and parent graphs, savepoint row recovery, fatal batch state,
  domain figures/overrides, counters, zero-based events, and report/pending-person persistence are integrated.
- CLI requires `app_api` and staging or explicit production confirmation. Undo checks terminal synthetic batches,
  provenance, fingerprints, later work and outside references, then deletes reports before tickets and audits.
- Main adds relational `ticket_tag` assignments with forced tenant RLS, composite FKs, cascade cleanup,
  exact idempotent replay, row-locked writes, actor-labelled history, and browser/axe coverage.
- Post-merge verification: 397 tests / 40 files and 22 / 22 desktop-phone E2E are green;
  independent review and GitHub CI remain.
- **Next**: obtain independent R3 review, commit the merge resolution and require green GitHub CI.
  Do not use this for real cutover from this handoff alone.

## Live on main

- M0 foundation: forced RLS and `app_api`, auth, settings/config, Cosmos seed and walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b: report/PDF, live board, PWA/share, offline outbox, push, needs-report, day report, admin faces,
  Desk Views, exact cancel time and per-person minutes.
- M1b gate evidence: 380 Vitest tests, 16 Playwright tests, full verification and R3 review.

## In flight

- `import-integration`: conflict resolution, full verification and Playwright are complete locally;
  independent review and GitHub CI remain.
- Real N1 export/Worker schema, reviewed N12 aliases and cutover runbook remain external.
- Severity, timeline/history and Bhavin Excel conversion are separate tasks, not part of this branch.

## Next

1. Commit the merge resolution and merge only after independent R3 review and green GitHub CI.
2. Implement M2-2.1 severity as the specified criticality/state matrix in its own slice.
3. Real N1 compatibility/cutover requires the external schema and human security sign-off.

## Blocked / external inputs

- N1 real export semantics, N11 real shifts, N12 older-set aliases, N5 Gujarati strings.
- AWS/domain/GitHub OIDC remain external; Terraform is authored but unapplied.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.
