# Status — 11 November 2026

Branch: `severity-matrix-implementation` (M2-2.1 severity matrix updated with current main).
The implementation contract and acceptance evidence are in `docs/slices/M2-2.1-severity-matrix.md`.

## Merged on main

- M0 foundation: schema v1 with forced RLS, composite tenant foreign keys, `app_router`/`app_api`,
  tenant isolation tests, auth, settings/config, Cosmos master seed and walking skeleton.
- M1a ticket core: domain figures, permissions and state machine; ticket API with row locks,
  idempotency and figures; floor/desk, lists and real browser harness.
- M1b: reports/PDF, live board, PWA/share, offline outbox, web push, needs-report, day report,
  admin faces, Desk Views, exact cancel time and per-person minutes.
- M1b import (#69/#70): safe synthetic-only contract, reconciliation, security checks and undo.
- M2 configurable tags (#71): relational `ticket_tag`, forced RLS/cascade, tenant catalogue,
  `canWork`/idempotency/row-locked writes, actor-labelled history and accessible browser states.
- Process: CI E2E, migration immutability, parity-update and lean checks.

## In flight: M2-2.1 severity matrix

- Pure `deriveSeverity` covers criticality × kind and general/urgent; `Ticket.severity` is non-null.
  Severity is not modelled through `ticket_tag`; the M2 tag boundary is unchanged.
- Migration 0006 backs up/backfills legacy rows, seeds tenant matrices, enforces CHECK values, then
  makes severity NOT NULL. Report-time criticality snapshots stay immutable.
- Raise and importer derive severity. Correct, upgrade-kind and machine-criticality changes recalculate
  current severity; raise and criticality updates serialize safely.
- Settings API validates matrix and criticality bodies (admin/head); `/config` is the only web source.
- Web severity appears on cards/detail and `/desk/settings`, with loading, role gate, offline read-only,
  text contrast, 52px targets and accessible status messages.
- Post-merge verification: 426 tests / 43 files and 30 / 30 desktop-phone E2E, with independent reviews PASS.
  The labelled PR and GitHub CI remain merge gates.

## Parity — `docs/spec/parity.yaml` (80 rows)

| Status      | Count | Meaning                                |
| ----------- | ----: | -------------------------------------- |
| done        |    16 | behavior covered with test/PR evidence |
| in-progress |    34 | partial behavior; listed gaps remain   |
| todo        |    26 | not built                              |
| external    |     3 | blocked on outside input               |
| waived      |     1 | intentionally dropped dead screen      |

`v3.import.01` remains `in-progress`; real N1 schema/compatibility and cutover remain external.

## Next

1. Commit the merge resolution, open the labelled PR and require green GitHub CI.
2. Continue with M2-2.2 SLA timers on their separate branch after the severity PR merges.
3. Real N1 compatibility/cutover requires the external schema and human security sign-off.

## Blocked / external inputs

- N1 real export semantics, N11 real shifts, N12 older-set aliases, N5 Gujarati strings.
- AWS/domain/GitHub OIDC remain external; Terraform is authored but unapplied.
- Staging/production execution is not part of this branch.
