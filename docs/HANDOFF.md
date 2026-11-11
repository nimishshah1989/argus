# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: branch `severity-matrix-implementation` implements **M2-2.1 severity matrix** end to end.

- Domain `deriveSeverity` covers criticality × kind and general/urgent; `Ticket.severity` is non-null.
- Migration 0006 backs up/backfills legacy rows, seeds per-tenant matrices, enforces CHECK values,
  then makes severity NOT NULL; snapshot stays nullable for general/unknown criticality.
- Raise and importer both derive severity. Correct, upgrade-kind and machine-criticality changes
  recalculate while preserving the report-time snapshot. Raise/criticality updates serialize.
- Settings API validates matrix and criticality bodies (admin/head). `/config` is the only web source.
- Web: severity on cards/detail plus `/desk/settings`; loading, role gate, offline read-only,
  WCAG text contrast, 52px targets and accessible status messages.
- Evidence: 13 severity API cases, 13 settings cases, 47 domain tests, migration backup/constraint
  tests, importer T46, 8 focused browser scenarios; independent DB + UI reviews PASS.
- Severity is **not** modelled through `ticket_tag`; the M2 tag boundary is unchanged.

- **Verification**: `pnpm verify` green (43 files / 423 tests), full Playwright 26/26; independent
  backend, DB/security and UI reviews all PASS.
- **Next**: commit the closeout. Timeline and real-data import stay separate slices.

## Live on main

- M0 foundation: schema v1 with forced RLS and `app_api`, auth, settings/config, Cosmos seed, walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b shipped early: report form/PDF, live board, PWA/WhatsApp share, offline outbox, web push, needs-report,
  day-report PDF, account/admin faces, Desk Views, exact cancel time and exact per-person minutes.
- Core fixes: request-path RLS, clock corrections, correction audit/overrides, idempotency binding and duplicate raise.
- Process: CI E2E, migration immutability, parity-update guards and lean checks.

## In flight

- `import-integration`: synthetic importer implementation complete; final verification and independent review remain.
- Real N1 export/Worker schema, reviewed N12 aliases and cutover runbook remain external and are not implemented.

## Next

- Independent architecture/schema/code/security/test/lean/data reviews for the importer PR, then green GitHub CI.
- Day-report follow-ups, shared-login E2E, real Gujarati strings, then M2 SLA/escalation and M4 analytics.

## Blocked / external inputs

- N1 Bhavin live export and Worker source; N11 real shifts; N12 legacy aliases; N5 Gujarati strings.
- Real import/cutover remains blocked on those inputs and human security sign-off, not on synthetic test coverage.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.

---

## M1b Gate Record — 2026-11-11

**SHA:** 1b4a06d (main)

**Milestone:** M1b — safe synthetic importer with strict schema and undo

**Evidence:**

- R3 adversarial review: PASS
- 380/380 Vitest tests
- 16/16 Playwright E2E
- Full typecheck, lint, format, parity, licences, migrations, lean pass

**Key deliveries:**

- `apps/server/src/import/` — contract, security, undo, reconciliation modules
- `docs/slices/M1b-import.md` — 51-test plan and execution record
- No unsafe ae17369 behaviors
- size:large documented and approved

**Next gate:** M2 preparation begins. Awaiting real Bhavin N1/N12 inputs for cutover authorization.
