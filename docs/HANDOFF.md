# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: branch `import-integration` has the corrected **synthetic-only** M1b importer integrated.
It accepts only `argus.synthetic-bhavin/v1`; real Bhavin/N1 exports are rejected before a batch.
No migration, dependency, frontend change, production execution, or real compatibility claim is included.

- Strict contract/aliases, canonical identity and parent graphs, savepoint row recovery, fatal batch state,
  domain figures/overrides, counters, original zero-based events, and report/pending-person persistence are integrated.
- CLI requires `app_api` and staging or explicit production confirmation. Undo checks terminal synthetic batches,
  provenance, fingerprints, later work and outside references, then deletes reports before tickets and writes audit.
- Full verification is green: `pnpm verify` (379 tests / 38 files), Playwright 16/16, build, parity,
  licences, migration and lean checks. The integration implementation commit is `0945ce2`; tests/artifacts follow.
- **Next**: commit the remaining integration/artifact increment, then obtain independent R3 review and green CI.
  Do not merge or use this for cutover from this handoff alone.

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
