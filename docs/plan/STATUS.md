# Status — 11 November 2026

Branch: `import-integration` (synthetic importer integration updated with current main).
This file separates merged main from in-flight work; the implementation contract and acceptance evidence
are in `docs/slices/M1b-import.md` and `docs/slices/M2-tags.md`.

## Merged on main

- M0 foundation: schema v1 with forced RLS, composite tenant foreign keys, `app_router`/`app_api`,
  tenant isolation tests, auth, settings/config, Cosmos master seed and walking skeleton.
- M1a ticket core: domain figures, permissions and state machine; ticket API with row locks,
  idempotency and figures; floor/desk, lists and real browser harness.
- M1b: reports/PDF, live board, PWA/share, offline outbox, web push, needs-report, day report,
  admin faces, Desk Views, exact cancel time and per-person minutes.
- M1b gate evidence: 380 Vitest tests, 16 Playwright tests, full verification and R3 review.
- Process: CI E2E, migration immutability, parity-update and lean checks.

## In flight: synthetic importer and current-main integration

The branch implements the reviewed synthetic contract `argus.synthetic-bhavin/v1` and rejects all real
or other sources before opening a batch. It does not implement N1 compatibility or cutover.

- Strict parsing, separate aliases, canonical identity, dependency-checked parent graphs and bounded inputs.
- Tenant-scoped reference loading, canonical work type/location codes, pending-person provenance and reports.
- Original zero-based event persistence, domain figure reconciliation/overrides, counters and completion fingerprints.
- Per-row raw/ticket savepoints, persisted fatal failure, recoverable row errors and honest batch statistics.
- Fail-closed `app_api` CLI, production confirmation, terminal-batch undo with provenance/later-work/outside-ref
  refusal, report-first deletion, preserved raw rows/people/counters/finished_at, and before/after audit.
- Current main's relational `ticket_tag` assignments remain included: forced RLS, composite tenant FKs,
  cascade cleanup, exact replay, row-locked writes and actor-labelled timeline events.
- Post-merge verification: 397 tests / 40 files and 22 / 22 desktop-phone E2E are green;
  independent review and GitHub CI remain.
- Independent R3 review and GitHub CI remain merge gates.

## Parity — `docs/spec/parity.yaml` (80 rows)

| Status      | Count | Meaning                                |
| ----------- | ----: | -------------------------------------- |
| done        |    16 | behavior covered with test/PR evidence |
| in-progress |    34 | partial behavior; listed gaps remain   |
| todo        |    26 | not built                              |
| external    |     3 | blocked on outside input               |
| waived      |     1 | intentionally dropped dead screen      |

`v3.import.01` remains `in-progress`, cites synthetic test evidence only, and records that real N1 export/
Worker schema/compatibility and cutover remain external. PARITY.md is the source; `tools/sync-parity.ts`
regenerates and `pnpm parity` validates the row and generated count.

## Next

1. Obtain independent R3 review, commit the merge resolution and require green GitHub CI before merge.
2. Implement M2-2.1 severity as the specified criticality/state matrix in its own slice.
3. Real N1 compatibility/cutover requires the external schema and human security sign-off.
4. Day-report follow-ups, shared-login E2E and real Gujarati strings precede later M2/M4 work.

## Blocked / external inputs

- N1 Bhavin live export and Worker source; N11 real shifts; N12 older-set aliases; N5 Gujarati strings.
- AWS/domain/GitHub OIDC remain external; Terraform is authored but unapplied.
- Staging/production execution is not part of this conflict-resolution branch.
