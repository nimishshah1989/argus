# 46 — the one M4b schema change

**What changed for a user:** nothing visible yet — this ticket adds the tables and columns M4b's features stand on,
then the write paths those tables allow. The plan is `docs/slices/46-m4b-schema.md`: packet 46a is migration 0015
(four tables, two new ticket channels and four failure-code columns with a list-item guard), packet 46b (below) is
the write paths the migration now permits.

**Not in 46a:** no code, no screen, no seed. **Not in 46b:** no screen (47 builds coded closes, 49/51 the screens).

**Plan revision (19 Nov):** a fresh review FAILed the first plan with nine must-fixes (seed rows for the four tenant
tables, the migration-runner 0015 entry, the PM report-data home, the real 46b files, the down file's header/ledger/
FORCE/function drop, the up header, the production-copy rehearsal, the new channels' SLA/drift/analytics policy, and
the intervention FK). The revised plan in this PR reflects all of them and the should-fixes.

## 46a — migration 0015

**What changed for a user:** nothing visible yet. The database can now hold a frozen monthly forecast, an
intervention, a PM plan and one asset register (AMC, warranty, legal, calibration), a ticket can be raised as planned
`pm` or `inspection` work, a breakdown report can carry the four failure codes and a PM job's report data, and one
shared channel predicate keeps planned and historical work off the SLA clocks, the drift list, escalation and live
analytics.

**The file.** `packages/db/migrations/0015_m4b_schema.sql` (202 lines) adds the four D17 tables, the two channel
values (the unnamed `ticket_raised_channel_check` is re-created named), `failure_component`, `failure_mode`,
`failure_cause`, `failure_action` and `pm_report` on `breakdown_report`, and the invoker-rights
`breakdown_report_check_failure_codes` trigger (each column checked separately, explicit `tenant_id` predicate, no
`active` filter). RLS, `tenant_isolation` and the app grants are the 0014 DO-block shape; `forecast` is the exception,
with a column grant that lets `app_user` write only `outcome`/`scored_at`, never `predicted`. The six indexes and the
`approved-by:`/`backup:` header are the plan's.
`packages/db/migrations/down/0015_m4b_schema.down.sql` (54 lines) checks for `pm`/`inspection` rows with row security
off and FORCE lifted on `ticket` (stopping with "Revert stopped: … Restore the snapshot instead"), drops the four
tables, the five columns, the trigger and its function, restores the old four-channel CHECK, deletes its own ledger
row and puts FORCE back.

**Channel policy.** `packages/shared/src/channel.ts` is the one predicate (`isBreakdownChannel` on the four live
channels `floor`/`desk`/`whatsapp`/`qr`) and the one list (`BREAKDOWN_CHANNELS`); `analytics/load.ts`,
`tickets/repo/sla.ts`, `tickets/repo/drift.ts`, `tickets/repo/escalation.ts`, `tickets/list.ts` and
`accountability/sla.ts` now read it instead of their own `import`/`backfill` string checks.

**Tests that prove it.** `pnpm exec vitest run packages/db/test/m4b-schema.test.ts` — 14 passed. It runs the migration
from scratch through `scripts/migrate.ts` as a non-superuser database owner, then exercises each acceptance bullet as
`app_user`: asset kinds and lead time, `pm`/`inspection`/`whatsapp` inserts and a bad channel, good/bad/other-tenant and
switched-off failure codes, `pm_report` round-trip and NULL on a non-PM report, PM meter fields and the no-target rule,
duplicate forecast, the `predicted` update refusal and `outcome` write, the cross-tenant intervention FK, and
cross-tenant invisibility. The same file runs the down while a `pm` ticket exists (refused, message checked), removes
it, applies the down, proves the four tables/columns/trigger/function are gone and the old CHECK refuses `pm` again,
then re-applies through the runner. Red first, with the up file temporarily absent: 1 failed file, 14 skipped,
`error: relation "forecast" does not exist`.
`pnpm exec vitest run packages/db/test/isolation.test.ts packages/db/test/migration-runner.test.ts` — 39 passed; the
isolation seed now has one row per tenant in the four tables, and the runner's `expectInstalled` 0015 artifact plus its
fault-injection case cover the four tables, five columns, trigger and channel values.
`pnpm exec vitest run apps/server/test/figures-drift.test.ts apps/server/test/sla-timers.test.ts` — 16 passed; a `pm`
ticket gets no `sla_timer` and no drift line, a `floor` ticket still gets its clock and drift, and history stays
excluded. The full required suite `pnpm exec vitest run apps/server/test packages/domain/test` — 174 files, 2014
tests passed (the known `escalation` flake and the two worktree-path deploy tests did not appear in this run).

**Verbatim command tails.**

- `pnpm exec vitest run packages/db/test/m4b-schema.test.ts` → `Test Files  1 passed (1)` / `Tests  14 passed (14)`.
- `pnpm exec vitest run packages/db/test/isolation.test.ts packages/db/test/migration-runner.test.ts` → `Test Files  2 passed (2)` / `Tests  39 passed (39)`.
- `pnpm exec vitest run apps/server/test packages/domain/test` → `Test Files  174 passed (174)` / `Tests  2014 passed (2014)`.
- `pnpm migrations:check` → `migrations: 15 files, 0 findings`.
- `pnpm migrations:immutable` → `migrations:immutable: 0 existing migration files changed`.
- `pnpm boundaries` → `boundaries: 212 files scanned, 0 problem(s)`.
- `pnpm precheck` → `precheck: OK — 17 file(s) checked by prettier, 13 checks passed` (the six pre-existing lint
  warnings: one `max-lines` and five unused eslint-disable).

**Production-copy rehearsal: not run, and not claimed.** The AWS credential in this checkout can list RDS, and it
shows only the live `uptimo-postgres` in `ap-south-1`: there is no restored `-restore` copy, and the live database is
not reachable from the internet. Creating a restore is an operator action with a cost, so no migration was run against
AWS. The up → down → up was run on the migrated test container instead, as the non-superuser owner (the same path
`scripts/migrate.ts` uses). The operator step on the restored copy still has to be run before the gate.

**Deviations and notes recorded.**

1. **Imported tickets no longer take an SLA clock or escalation.** The single live-breakdown predicate is the four
   channels only; `import` and `backfill` are both history. That matches the comments in `accountability/sla.ts`
   ("an import of history has no live clocks") and the plan's promise that `floor`/`desk`/`whatsapp`/`qr` behaviour
   stays identical; no existing test asserted clocks for an imported ticket.
2. **`pm`/`inspection` analytics read as `source: history`.** `TicketRow.source` has only `live`/`history` and the plan
   names only `analytics/load.ts:72`; planned work is therefore not a live breakdown, and the planned-work view is
   left for 49/52 rather than growing the domain type in this packet.
3. **Stored figures are kept for any non-live channel.** `tickets/list.ts` used a set of `import`/`backfill`; it now
   uses the same predicate, so a planned ticket keeps its stored (empty) figures instead of being recomputed as a
   breakdown.
4. **`as_of` is `NOT NULL`.** The plan's column list omitted the marker but its acceptance says a forecast needs
   month/as_of/profile/model/predicted; the table enforces all five.
5. **Tenancy is stronger than the plan's shorthand.** The machine and PM-plan foreign keys are composite
   `(tenant_id, id)` FKs, so a cross-tenant machine cannot be referenced either; `decided_by_person_id` and
   `owner_person_id` keep the simple `person(id) ON DELETE SET NULL` shape (a composite SET NULL would clear
   `tenant_id`).
6. **The seed uses `amc` and `calibration`.** The four kinds are proved by the m4b test; the seed only needs the
   one-row-per-tenant rule.

## 46b — the write paths

**What changed for a user:** nothing visible yet. The server can now raise planned `pm`/`inspection` work through a
published tickets function (the HTTP raise refuses those channels from a person and accepts `floor`/`desk`/`whatsapp`/
`qr`), store a close's four failure codes and a PM job's ticked checklist/readings in `breakdown_report`, and write
one `pm_plan` draft and one `asset_register` row through the plant module's interface.

**The files.** `packages/shared/src/ticket.ts` adds an optional `channel` to `raiseTicketSchema` (the four live
channels, the same list as `BREAKDOWN_CHANNELS`) and `pmReportSchema` + the five optional report fields to
`breakdownReportSchema`; `packages/shared/src/ticket-reply.ts` carries them on a stored report. The four codes have no
shared list: the database trigger is the only judge (the test seeds the plant's `failure_code` items). A bad code's
`23514` is mapped to the report's field, so the close answers 422 rather than 500; the rollback is proved by the
ticket still being `working`.
`apps/server/src/modules/tickets/planned.ts` (new) is the published `raisePlannedTicket` (pm/inspection, machine or
plan side, caller's transaction) exported from the module index; `severity.ts` no longer hard-codes the channel and
`repo/ticket.ts` inserts `raised_channel`. `repo/report.ts` writes/reads the five report columns and
`import.ts` carries them through the past-breakdown/import path, with older callers leaving them out (the import path
writes them as a second UPDATE only when a report has one, so the migration tests that load the plant on a pre-0015
schema keep running the same code). `routes.ts` is unchanged (384 lines; the schema does the HTTP refusal).
`apps/server/src/modules/plant/repo/records.ts` (new) holds `insertPmPlan`/`pmPlanById` and
`insertAssetRegister`/`assetRegisterById`, exported from `plant/index.ts`, and `manifest.ts` gives the plant module
ownership of the two tables.

**Tests that prove it.** `apps/server/test/m4b-write.test.ts` (new, 8 tests) raises pm and inspection through the
published path and reads the channel back, refuses `pm`/`bogus` on the HTTP raise while `floor` still works, starts a
published PM job, closes it with the four codes and `pmReport` and reads them back, has a bad code refused by the
database without closing the ticket, carries the codes and PM report through a past breakdown, and writes/reads one
`pm_plan` draft and one `asset_register` row as `app_user`. Each machine has no open ticket (fresh ids, `VC-2`…).

**Verbatim command tails.**

- red first `pnpm exec vitest run apps/server/test/m4b-write.test.ts` → `Test Files  1 failed (1)` / `Tests  7 failed (7)` (`insertPmPlan is not a function`).
- `pnpm exec vitest run apps/server/test/m4b-write.test.ts` → `Test Files  1 passed (1)` / `Tests  8 passed (8)`.
- `pnpm exec vitest run apps/server/test packages/db/test packages/domain/test` → `Test Files  191 passed (191)` / `Tests  2171 passed (2171)`.
- `pnpm precheck` → `precheck: OK — 20 file(s) checked by prettier, 13 checks passed` (the six pre-existing lint warnings: one `max-lines` and five unused eslint-disable; the size tool's soft 250-line warnings).
- `pnpm boundaries` → `boundaries: 214 files scanned, 0 problem(s)`.

The known flakes (escalation, worktree-path deploy) did not appear in the final run.

**Deviations and notes.**

1. **`raisedLoginId` is nullable in the domain.** Planned raises come from a job, not a login, and the column already
   allows NULL; the `Ticket`/`RaiseInput` type now says so. No behaviour changes for a person's raise.
2. **The published raise does not run the reply parts.** 49/52 need the ticket in their own transaction, not an HTTP
   reply; the channel policy (46a) already keeps planned work off the SLA/drift lists. A listener can be added when a
   screen exists.
3. **The PM report's `doneBy` is a person id (uuid), and `comments` is nullable.** The rest of the frozen shape is
   `{total, undone[], readings{}, ...}` with defaults for the optional keys, so a ticked job stores a complete object.
4. **The imported report writes its M4b fields in a second UPDATE, only when it has one.** The three migration tests
   load the real plant on a pre-0015 schema and then run the current import code; keeping the base INSERT's column
   list unchanged lets that path run, while a coded past breakdown still writes the five fields and the trigger still
   judges the codes.
