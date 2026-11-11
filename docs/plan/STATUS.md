# Status — 11 November 2026

Branch: `tag-system-planning` (M2 configurable ticket tags). This file separates merged main from
in-flight work; the implementation contract and actual acceptance output are in `docs/slices/M2-tags.md`.

## Merged on main

- M0 foundation: schema v1 with forced RLS, composite tenant foreign keys, `app_router`/`app_api`,
  tenant isolation tests, auth, settings/config, Cosmos master seed and walking skeleton.
- M1a ticket core: domain figures, permissions and state machine; ticket API with row locks,
  idempotency and figures; floor/desk, lists and real browser harness.
- M1b: reports/PDF, live board, PWA/share, offline outbox, web push, needs-report, day report,
  admin faces, Desk Views, exact cancel time and per-person minutes.
- M1b import (#69/#70): safe synthetic-only contract, reconciliation, security checks and undo.
- Process: CI E2E, migration immutability, parity-update and lean checks.

## In flight: configurable ticket tags only

- `ticket_tag` persistence with forced tenant RLS, composite tenant FKs, cascade lifecycle and actor
  preservation; per-tenant `list_item` catalogues with no domain fixture or manual severity model.
- `canWork` authorization, required idempotency keys, exact stored-response replay, ticket row locks,
  effective `tag_add`/`tag_remove` history and malformed-id handling.
- Empty/loading/selected/read-only/error browser states, inactive applied removal, and serious/critical
  axe checks. Browser code does not bundle the server Zod schema.
- Local isolated verification: **397 tests / 40 files**, **22 / 22 desktop-phone E2E**, production
  build, lint, formatting, migrations, immutability, lean, licences, parity and declared size check.
- `size:large` is required for the test-heavy vertical slice; `no-parity` applies because this is a
  written addition, not an existing parity row. Actual PR labels/CI remain a merge gate.

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

1. Fresh independent review of the final commit, then PR labels and green GitHub CI before merge.
2. M2-2.1 derives S1–S4 from the plant criticality/state matrix in its own slice.
3. Real N1 compatibility/cutover requires the external schema and human security sign-off.

## Blocked / external inputs

- N1 real export semantics, N11 real shifts, N12 older-set aliases, N5 Gujarati strings.
- Terraform remains unapplied; staging/production execution is not part of this branch.
