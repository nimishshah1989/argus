# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE (M2 configurable tags)

**State**: `tag-system-planning` is a focused branch from current `main`; the original mixed planning
branch is preserved as `tag-system-planning-superseded`. The tag implementation and acceptance evidence
are complete. Independent final review and GitHub CI remain; do not merge until both pass.

- `ticket_tag` replaces the unmerged `setting` prototype: forced tenant RLS, composite tenant FKs,
  ticket/item cascade, actor/time, and uniqueness.
- Catalogue values come only from tenant `list_item` rows (`breakdown_category`, `maint_code`,
  `work_type`). There is no synthetic domain catalogue and no manual severity tagging.
- Writes enforce `canWork`, exact idempotent replay, one locked transaction, and `tag_add`/`tag_remove`
  history. Tests cover every role, two tenants, concurrent writers, replay, validation and cascade.
- Browser coverage includes empty/loading/selected/read-only/error states, inactive removal and axe.
- Local verification: 397 tests / 40 files, 22 / 22 desktop-phone E2E, build, lint, formatting,
  migrations, immutability, lean, licences, parity and declared size check all green.
- The slice and executable acceptance matrix live in `docs/slices/M2-tags.md` with red/green evidence.
- N12 remains consistently **open** for the older 1,158-row cutover set; no unresolved alias is encoded
  as a production tag rule. M2-2.1 separately derives S1–S4 from the criticality/state matrix.

## Live on main

- M0 foundation: forced RLS, `app_api`, auth, settings/config, Cosmos seed and walking skeleton.
- M1a ticket core: domain state/figures/permissions, ticket API, floor/desk, lists and real E2E harness.
- M1b: report/PDF, live board, PWA/share, offline outbox, push, needs-report, day report, admin faces,
  Desk Views, exact cancel time and per-person minutes.
- M1b import (#69/#70): safe synthetic-only contract, reconciliation, security checks and undo.
- M1b gate evidence: 380 Vitest tests, 16 Playwright tests, full verification and R3 review.

## In flight

- `tag-system-planning`: isolated checks green; fresh final review and PR/CI are next.
- Severity, timeline/history and Bhavin Excel conversion are separate tasks, not part of this branch.

## Next

1. Obtain the independent PASS, create the labelled PR and require green GitHub CI.
2. Merge only after green CI; staging/production execution is not part of this session.
3. Implement M2-2.1 severity as the specified criticality/state matrix in its own slice.
4. Real N1 compatibility/cutover remains external and requires human security sign-off.

## Blocked / external inputs

- N1 real export semantics, N11 real shifts, N12 older-set aliases, N5 Gujarati strings.
- AWS/domain/GitHub OIDC remain external; Terraform is authored but unapplied.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.
