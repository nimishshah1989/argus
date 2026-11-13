# PR body draft: 07 History cannot be lost

Closes #85. Labels: `size:large` (about 4,300 changed lines, two thirds tests: the database tiers need a container per
file), `no-parity` (no parity row changes; the behaviour is the database refusing to lose history).

## What changed for a user

Nothing on screen. Underneath, history can no longer be deleted or rewritten, even by a bug in the app. A machine can
have only one open breakdown at a time.

- **Leavers (DATA-MAP section 5).** On request, a leaver's name becomes "Former staff" on every ticket, report, history
  line and import record. Their logins are switched off and their own devices signed out; a shared floor phone stays
  signed in. If their name is only one or two letters, the tool switches them off at once, prints the list of places the
  plant must check by hand, and does not mark the request complete until that check is recorded (`erase: review pending`,
  exit 3; recorded with `--review-done`).
- **A customer who leaves (question 25, the default you approved).** Everything of theirs is deleted except their own
  record, kept as "left" with its name, language, time zone and plan, and one audit line holding the export and backup
  references and who did it. This is the "offboarded stub". **Your call:** should the customer's name also be blanked on
  that record? (One line in `offboard_tenant` if yes.)
- **Support access.** Needs a customer admin's approval and ends within 7 days. Every existing grant is ended at the
  cutover, each change written to the audit trail.
- **Tags.** Removed. Staging has none. On a database that holds tags, `tsx scripts/export-tags.ts --out <backup folder>`
  writes `ticket_tag-<date>.csv` (all columns, header) beside the backup and prints the count; the migration will not run
  until that count is given with `PGOPTIONS='-c uptimo.tags_exported=<N>'`.

## Staging, in order

1. **Backup first:** `aws rds create-db-snapshot --db-instance-identifier uptimo-postgres --db-snapshot-identifier
uptimo-pre-0009-<date>`, then `aws rds wait db-snapshot-available --db-snapshot-identifier uptimo-pre-0009-<date>`.
   Send the identifier to the orchestrator.
2. `ROUTER_DATABASE_URL` goes in **`migrate.env` only**, set to the same value as `MIGRATION_DATABASE_URL`. Never in
   `app.env`: the running server must not have it. Only `import:undo` reads it.
3. `gh workflow run deploy.yml`, then `gh run watch`. If it stops at "migration failed", nothing changed (one transaction
   per file); send the log line.
4. Open `site_url/api/v1/health` and expect `{"status":"ok"}`.

On a database that holds data (none exists today), two steps go between 1 and 3: `tsx scripts/preflight-cutover.ts` until
it exits 0, then `tsx scripts/export-tags.ts`.

## Not yet proven on real RDS (schema notes section 8)

Whether RDS's master behaves like the stand-in owner used in CI (test 44: a `CREATEROLE CREATEDB` owner that is not a
superuser), pg-boss's own install as that user, and `pgcrypto`. Staging is the first real run. `PGOPTIONS` through `pg`
was read in `connection-parameters.js` and is now exercised end to end by test 45.

## Reviews

- **Schema:** schema-reviewer PASS-with-conditions after 3 rounds (round 1: ten findings; round 2: scoped re-check, two
  findings; round 3: PASS-with-conditions). The conditions were documentation and are applied.
- **Plan:** plan-reviewer FAIL with 8 text gaps (unsafe storage key, empty-database Given, scripts-test order, review-row
  `entity_id`/`login_id`, test-44 password constant, red-first accounting and the `OWNERS` assertion, test 37's accepted
  owner URL, test 34's helper type). All fixed in the plan text, no design change; no second round, by orchestrator
  ruling.

## Replaced tests (each at least as strict as the one it replaces)

1. `preserves a tag assignment when its login and person are deleted` becomes two tests (1, 2). Old: one delete as
   `app_user`, two column values checked. New: two refusals per table (privilege, then RESTRICT as owner) and the row
   still present, for both login and person.
2. Policy-count assertion and `gives app_user no bypass and app_router bypass` become test 3 and 4. Old: one policy per
   table, one attribute pair. New: the exact policy names per table and their role (`router_definer` on exactly the 16
   tables of 0009 part 8, `TO app_router`), and neither role bypasses; any extra, missing or widened policy fails.
3. `T21 cascades ticket tags on undo` becomes `T21 removes the batch's SLA timers and keeps its import rows while
preserving the tenant`. Old: the tag rows go with the ticket and the tenant stays. New: the timer goes with the
   ticket, the import row stays with its link emptied, and the tenant stays.
4. `T17` undo half. Old: an owner URL and a BYPASSRLS URL are refused for undo. New: the `app_api` URL and the BYPASSRLS
   URL are refused by a membership check (`assertRouterRole`) that refuses every non-member login; the owner URL is the
   intended credential (decision 2). The import half is unchanged.
5. `tools/boundaries.test.ts`: 30 to 29 tables (`ticket_tag` dropped, `ai_suggestion` from main kept), one owner each, plus a new test that no dropped table is owned and each
   database function is owned exactly once.

Other edits to existing tests, all forced and none weaker: `migration-runner.test.ts` "refuses to adopt an unledgered
0007 schema" now expects the ledger to hold the files before 0007 (it was "all files but 0007"; the run stops at 0007, so
0009 is not reached); the import CLI tests pass `--operator agent-test` and a router URL; every undo test calls
`undoImport(db.router, tenant, batch, 'agent-test')`; `seedBatch` stamps `finished_at` from the database after its rows.

## Tests that prove it

Plan section 6, numbers 1 to 56. Pass counts at the end of this branch:

- After merging `main` (with `0008_ai_suggestion`), one run each: `packages/db` + `tools` + `scripts`: 24 files, 183
  passed; `apps/server`: 43 files, 416 passed. Before the merge the implementer's combined run had one failure, a
  test-order bug in test 56 (a first scenario's PDF rows leaked into the second), fixed; the file then passed twice in a
  row. Fast set (`.claude/harness/fast-tests.sh`): 33 files, 275 passed.
- Gates: `migrations:check` 0 findings, `migrations:immutable` 0 changed, `boundaries` 0 problems, `docs:check` 0,
  `pii:scan` 0, `typecheck`, `lint`, `format:check`, `changelog:check` clean.

### Red first

- Tests 29 to 38, 40 to 44, 47, 49 to 52, 54, 55, 56 were written before their code and seen failing on the branch head
  (for example test 29 `expected false to be true`; test 55 `owns no dropped table and owns each database function
exactly once` failed until `manifest.ts` changed; tests 49 to 52 failed four of four before the scanner).
- Tests 1 to 28, 39 and 45 (and 14, 46) exercise the committed migration. Run in a `git worktree` on the parent commit
  `2fe99fa` (no 0009) with the new test files, runner and scripts copied in:
  - `isolation.test.ts`, `history.test.ts`, `definer-functions.test.ts`: 3 files failed in `beforeAll`, 35 tests skipped,
    `error: column "approved_by_login_id" of relation "platform_access" does not exist` (the seed needs 0009).
  - `migration-runner.test.ts` tests 14, 44, 45, 46: 4 of 4 failed (`promise resolved "{ ...(2) }" instead of rejecting`
    for the duplicate guard and the tag guard; `expected true to be false` for the delete privilege after up).
  - `cutover-scripts.test.ts` (39, 40, 41, 42, 56): 5 of 5 failed (`ENOENT .../0009_history_cannot_be_lost.sql`; the tag
    export still finds 3 rows; `erase_person` missing). Test 15 (preflight) passes there by design: it needs no 0009.

## Code review (one pass, fresh context; the Athena reviewer agents were retired by pstack while this PR was open)

FAIL on first pass. Fixed in this PR: the `CREATE` lent to `app_router` is now taken back on every failure path of the
runner (new runner test); test 26 asserts the technician insert succeeded and matches the trigger's own message; test 34
asserts the exact role query; `erase-person.ts` prints the storage keys it could not remove. Deviation recorded:
`undo.ts` still uses `withTenant` (plan decision 1 needs the tenant-scoped transaction on the router connection; plan §3
said to delete the import). Waiting on CI for the head commit before the PR leaves draft. Not fixed here (follow-ups):
the migration scanner still misreads an odd apostrophe inside a dollar-quoted or `E'..'` literal and an `UPDATE` of a
quoted identifier containing a space; neither is in a real migration.

## Follow-ups (not in this PR)

- **Raise race:** a second open breakdown raised at the same instant now ends in a unique violation (a 500) instead of a
  silent duplicate. Map `ticket_open_breakdown_unique` to today's "already open" reply.
- **`infra/instance/refresh-env.sh`:** one line writing `ROUTER_DATABASE_URL=` from the existing
  `MIGRATION_DATABASE_URL` into `migrate.env`, plus its `tools/staging-deploy.test.ts` expectation.
- **Operator scripts:** `offboard-tenant` (export, storage prefix, queued jobs, then the function) and `audit-purge`
  (scheduled). The functions are built and tested; the scripts are not.
- **S3 deletion of erased files** joins when the S3 adapter lands (the erase script deletes under `--files-dir` now).
- **Lead-person filter** rewrite as a UNION with its two indexes (notes open question 6).
- **`ai_suggestion` (migration 0008, now on `main`):** `erase_person` does not know its `output` column, and its keys to
  `person` and `login` are `SET NULL` and to `ticket` `CASCADE`. A follow-up needs `CREATE OR REPLACE erase_person` and
  RESTRICT keys. `main` is merged into this branch; the seed and the isolation test already carry its row.
- **Decision file:** ours is `docs/decisions/D24-database-roles-and-definer-functions.md` (D23 on `main` is pstack).
