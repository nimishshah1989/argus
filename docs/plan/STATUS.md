# Status — 11 November 2026

Branch: `severity-matrix-implementation` (M2-2.1 severity matrix). This file separates merged main from
in-flight work; the plan and review gates are in `docs/plan/backlog.md` and `docs/slices/M1b-import.md`.

## Merged on main

**M0 foundation**

- Schema v1 with forced RLS, composite tenant foreign keys, `app_router` functions and least-privilege
  `app_api`; generic tenant isolation tests. Auth, host tenancy, settings/config and Cosmos master seed.
- Walking skeleton and authored (unapplied) Terraform infrastructure.

**M1a ticket core**

- Domain figures, permissions and state machine; tickets API with row locks, idempotency and figures;
  floor and desk faces, lists and the real Postgres/API/browser E2E harness.

**M1b slices shipped early**

- Breakdown report form/storage/PDF, Live board/kiosk, WhatsApp share text, PWA shell, offline outbox,
  web push, needs-report list, day-report PDF, account/admin faces and Desk Views.
- Exact cancel timestamp and exact per-person minutes in ticket lists.
- Request-path RLS, clock corrections, correction audit/overrides, idempotency binding and duplicate-raise fix.
- CI E2E, migration immutability, parity-update and lean checks.

## In flight: M2-2.1 severity matrix

Branch `severity-matrix-implementation` (worktree `severity-matrix-implementation`).

- `packages/domain/src/severity.ts`: pure `computeSeverity` + `defaultSeverityMatrix` per DOMAIN.md
  §Severity; full unit coverage. No severity tags — the M2 tag boundary is unchanged.
- Migration `0006_severity_matrix.sql`: CHECK constraints on `ticket.severity` / `criticality_snapshot`
  and per-tenant default matrix seed.
- Raise derives severity from the machine criticality snapshot; `correct` and `upgrade-kind`
  recalculate it (`apps/server/src/ticket/severity.ts`).
- Settings API: `PUT /api/v1/settings/severity_matrix` (validated), `PUT /api/v1/machines/:id/criticality`;
  `/api/v1/config` serves the matrix and machine criticality.
- Web: severity badge on ticket cards, severity fact on detail, new `/desk/settings` screen
  (admin/head) for machine criticality and the matrix grid.
- Evidence: `apps/server/test/ticket-severity.test.ts` (8 cases incl. correction recalc),
  `packages/domain/test/severity.test.ts` (10 cases), `apps/server/test/settings.test.ts`
  (5 new settings cases). Slice plan: `docs/slices/M2-2.1-severity-matrix.md`.
- Remaining: independent review; timeline and real-data import stay separate slices.

## In flight: synthetic importer only

The integration branch implements the reviewed synthetic contract `argus.synthetic-bhavin/v1` and rejects
all real or other sources before opening a batch. It does not implement N1 compatibility or cutover.

- Strict parsing, separate aliases, canonical identity, dependency-checked parent graphs and bounded inputs.
- Tenant-scoped reference loading, canonical work type/location codes, pending-person provenance and reports.
- Original zero-based event persistence, domain figure reconciliation/overrides, counters and completion fingerprints.
- Per-row raw/ticket savepoints, persisted fatal failure, recoverable row errors and honest batch statistics.
- Fail-closed `app_api` CLI, production confirmation, terminal-batch undo with provenance/later-work/outside-ref
  refusal, report-first deletion, preserved raw rows/people/counters/finished_at, and before/after audit.
- Full verification passes: `pnpm verify` (380 tests / 38 files), Playwright E2E 16/16, build, parity,
  licences, migrations and lean checks. Independent R3 review and GitHub CI remain before merge.

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

- Commit the remaining integration/artifact increment.
- Obtain independent R3 review and green GitHub CI before merge; human security sign-off before real cutover.
- Real N1 export/Worker, N12 aliases and cutover runbook remain external.
- Day-report follow-ups, shared-login E2E, real Gujarati strings, then M2 SLA/escalation and M4 analytics.

## Blocked / external inputs

- N1 Bhavin live export and Worker source; N11 real shifts; N12 legacy code aliases; N5 Gujarati strings.
- Terraform remains unapplied; staging/production execution is not part of this branch.

## 2026-11-11 — M1b complete

- Importer integration merged to main (PR #70)
- Design-audit merged (PR #68)
- Preview baseline merged
- Live cost panel installed
- Task-18 severity stub complete
- Task-17 tags design complete
- Task-19 history stub planned

M2 preparation ready. Awaiting real Bhavin inputs.
