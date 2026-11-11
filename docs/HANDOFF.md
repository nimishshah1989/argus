# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: branch `severity-matrix-implementation` (worktree of the same name) implements **M2-2.1 severity matrix**.

- `packages/domain/src/severity.ts`: pure `computeSeverity` (criticality A/B/C × kind stopped/support,
  general uses urgent flag), `defaultSeverityMatrix` per DOMAIN.md §Severity. Full unit coverage.
- DB: migration `0006_severity_matrix.sql` — CHECK constraints on `ticket.severity` /
  `ticket.criticality_snapshot` (columns existed from v1) and seeds the default matrix setting per tenant.
- Server: raise derives severity from the machine criticality snapshot at report time
  (`apps/server/src/tickets.ts` `raiseExtras` + `apps/server/src/ticket/severity.ts`);
  `correct` (machine/kind change) and `upgrade-kind` recalculate it in `persistResult`.
- Settings API: `PUT /api/v1/settings/severity_matrix` (validated), `PUT /api/v1/machines/:id/criticality`.
  `/api/v1/config` serves `severityMatrix` and machine criticality.
- Web: severity badge on ticket cards, severity fact on detail, `/desk/settings` screen
  (admin/head) edits machine criticality and the matrix grid.
- Severity is **not** modelled through `ticket_tag`; the M2 tag boundary is unchanged.

- **Next**: green `pnpm verify`, then independent review. Timeline and real-data import stay separate slices.

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
