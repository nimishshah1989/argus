# 07 — History cannot be lost (build slice)

Issue: [#85](https://github.com/nimishshah1989/argus/issues/85) · Milestone M0 · Blocked by: 06 (merged) ·
Branch `claude/t07-history-cannot-be-lost`. One PR, body contains `Closes #85`.

**The schema is done and reviewed; do not edit it.** `packages/db/migrations/0009_history_cannot_be_lost.sql`,
`packages/db/migrations/down/0009_history_cannot_be_lost.down.sql`, `docs/slices/07-schema-notes.md` (cited below
as "notes §n") and D24. Verdict history: schema-reviewer **PASS-with-conditions after 3 rounds** (round 1: ten
findings, notes §13; round 2: scoped re-check, two findings; round 3: PASS-with-conditions, documentation items
applied, 13 Nov). If any test below shows the migration itself is wrong, or any statement of 0001–0009 fails as a
non-superuser owner (test 44), **stop**: that goes back through the architect and the schema-reviewer.

**The branch head is red today.** 0009 is committed, so the existing isolation, import and CLI suites fail (seed
inserts `ticket_tag`; import undo refuses every fresh batch, notes open question 1). This slice turns them green.

Labels: `size:large` (about 1,300 changed lines, two thirds tests; reason in the PR body) and `no-parity` (no
parity row changes; the behaviour is the database refusing to lose history).

## 1. Goal

Nobody, including the app, can delete or rewrite a ticket's history any more: the database refuses it, a leaver's
name can be erased everywhere it sits without deleting a single history line, a customer can be removed only with
an export and a backup on record, and a second open breakdown on one machine is impossible.

## 2. Decisions (technical; made here so the coder never guesses)

1. **Import undo runs on a second connection.** `import:undo` reads `ROUTER_DATABASE_URL` and nothing else; the
   import path keeps `DATABASE_URL` and `assertAppApiRole`. In one transaction on the router connection:
   `SET LOCAL ROLE app_user`, set `app.tenant_id`, run today's TypeScript checks (lock, contract, completion
   fingerprint), `RESET ROLE`, then `SELECT import_undo($1, $2)` (notes §8). The function does the deletes, the
   status change and the audit row, so `deleteCandidates`, `finishUndo`, `assertNoOutsideReferences` go: the
   function refuses the same outside-child and file cases with messages the existing tests' regexes already match
   (`outside`, `file`).
2. **Tests use the same split.** `apps/server/test/harness.ts` creates a non-superuser login `uptimo_router`
   (member of `app_router` and `app_user`) and returns `router: Pool` and `routerUrl`. Every undo test calls
   `undoImport(db.router, …, 'agent-test')`; the CLI tests pass `ROUTER_DATABASE_URL: db.routerUrl`. This is the
   RDS shape (a member, not a superuser), so CI proves the policy model, not superuser powers.
3. **`finished_at` comes from the database clock** (`clock_timestamp()`) in `finishBatch` and `failBatch`; the
   `finishedAt` input and `markBatchFatal`'s `now` go. Reason: the import writes its rows in one transaction whose
   `created_at` is that transaction's `now()`, later than the JavaScript clock read before `openBatch`, so
   `import_undo` would refuse every batch (notes §10 row 2).
4. **Seed approver without breaking the one-row rule.** `isolation.test.ts` asserts exactly one row per tenant in
   every table, so the seed does not add logins: the existing login of each tenant becomes `role = 'admin'`
   (`asha` stays non-shared; `cell-phone` stays shared) and is named in `platform_access.approved_by_login_id`.
   No assertion reads those roles (checked). The `ticket_tag` insert goes.
5. **One migrated-database helper for the package tests.** `packages/db/test/migrated.ts` (new) replaces the
   container/migrations/jobs/seed block of `isolation.test.ts`' `beforeAll` and is used by the two new test files
   and the scripts test (three users). `migration-runner.test.ts` keeps its own per-test containers.
6. **Operator scripts run on `MIGRATION_DATABASE_URL`** (D24 point 3), loop over `tenant` (no row security) and
   use the existing `withTenant` from `packages/db/src/tenant.ts` per tenant, because on RDS the owner sees a FORCE
   table only through its policy (notes §8). `scripts/operator-db.ts` holds the two shared lines (pool, tenant
   list) for the three scripts.
7. **Erasure completion.** `scripts/erase-person.ts` exits **0** and prints `erase: complete` only when the audit
   row says `text_searched: true` (or a review is already recorded). With `text_searched: false` it prints the
   hand-review list (DATA-MAP §5 last paragraph) and `erase: review pending`, and exits **3**. The review is
   recorded by a second run with `--review-done`, which writes one `audit_log` row, action
   `person.erase.review`, `after = {request_ref, operator}`, and then prints `erase: complete`. No new table.
8. **Storage objects.** There is no S3 adapter yet (`files/store.ts` is local disk). `erase-person.ts` requires
   `--files-dir <dir>` and removes each returned `s3_keys` entry under it (`rm`, `force: true`), checking every key
   first: a key that is absolute or contains `..` prints `erase: unsafe storage key <key>`, exits 1, and no file
   is deleted. S3 deletion joins when the S3 adapter lands (out of scope).
9. **Tag export format.** CSV with a header, every column of `ticket_tag` as PostgreSQL's own text output
   (`rowMode: 'array'`, a type parser that returns the raw string), `NULL` as an empty unquoted field, any value
   containing `,` `"` CR or LF quoted with `""` doubling, so the down file's `\copy … WITH (FORMAT csv, HEADER)`
   reloads it. File name `ticket_tag-<YYYYMMDDTHHMMSSZ>.csv` in `--out <dir>`.
10. **Migration-check scanner.** `blankComments` becomes a one-pass scanner with four states: code, single-quoted
    string (`''` stays inside), double-quoted identifier, `--` line comment, `/* */` block comment (nesting
    counted). Comments become spaces (newlines kept, so line numbers hold); string and identifier text is kept and
    still scanned (as today: a keyword inside a string is a false positive that only costs an approval). Dollar
    quotes are **not** strings: `DO $$ … $$` bodies are SQL and must stay scanned. The `UPDATE` rule gains
    `(?:\s*\*)?` after the table name so `UPDATE ONLY t * SET` is caught.
11. **Function owners in the manifest** (notes §7): `import_undo` → imports; `erase_person`, `erase_json_values`,
    `offboard_tenant`, `platform_access_guard` → identity; `audit_purge` → ops. `ticket_tag` leaves `tickets`.
12. **Dead code goes with the old undo:** `deleteImportedTickets`, `outsideChildRef`, `reportWithFileId`
    (`tickets/repo/imported.ts`, export lines in `tickets/index.ts`), `fileIdForTickets` (`files/repo.ts`,
    `files/index.ts`) and `markUndone` (`imports/repo.ts`) have no other caller (checked).
13. **Not built here:** an offboarding script, an `audit.purge` script, the `infra/` env line, the 23505 mapping
    in `raise` (see §10 and §12). The functions are tested directly; the ticket asks for the functions and the
    leaver script only.

## 3. Files

### New

| File                                         | What                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/operator-db.ts`                     | `operatorPool`, `listTenants` (§4). About 25 lines.                                                                                                                       |
| `scripts/export-tags.ts`                     | Decision 9; output in §4. About 80 lines.                                                                                                                                 |
| `scripts/preflight-cutover.ts`               | Duplicate query of 0009 part 1 per tenant, tag count, grants that end at cutover; exit 1 on any duplicate; exit 0 when `to_regclass('public.ticket')` is null. ~85 lines. |
| `scripts/erase-person.ts`                    | Decisions 7, 8; `HAND_REVIEW` exported. About 170 lines.                                                                                                                  |
| `packages/db/test/migrated.ts`               | `startMigratedDb` (§4).                                                                                                                                                   |
| `packages/db/test/history.test.ts`           | Tests 5–9, 13, 26–28.                                                                                                                                                     |
| `packages/db/test/definer-functions.test.ts` | Tests 16–25.                                                                                                                                                              |
| `packages/db/test/cutover-scripts.test.ts`   | Tests 15, 39–43, 56 (order fixed, §6).                                                                                                                                    |
| `apps/server/test/history-indexes.test.ts`   | Tests 10–12.                                                                                                                                                              |
| `changes/85-history-cannot-be-lost.md`       | Fragment (§9).                                                                                                                                                            |

### Changed

| File                                                                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/migrate.ts`                                                                                         | Notes §8 steps 1–3: `prepareRoles` after the advisory lock; `canGrantBypass`; `withoutBypassGrant` applied to `0001_schema_v1.sql` only when it is false; `revokeLentCreate` after the last file (on the failure path too, its own error swallowed so the migration error survives); narrowed `secureAppApiRole`. `applyAppMigrations` signature unchanged, stays under 60 lines.                                     |
| `tools/check-migrations.ts`                                                                                  | Decision 10. Exports unchanged.                                                                                                                                                                                                                                                                                                                                                                                       |
| `apps/server/src/modules/imports/repo.ts`                                                                    | `failBatch`/`finishBatch`: `finished_at = clock_timestamp()`, `finishedAt` removed from both inputs. `markUndone` deleted. `callImportUndo` added.                                                                                                                                                                                                                                                                    |
| `apps/server/src/modules/imports/batch.ts`                                                                   | `markBatchFatal` input loses `now`; the `failBatch` call loses `finishedAt`.                                                                                                                                                                                                                                                                                                                                          |
| `apps/server/src/modules/imports/bhavin.ts`                                                                  | Drop `finishedAt: context.now` (line 290) and `now` from the `markBatchFatal` call (line 317–322). `context.now` stays for its other uses.                                                                                                                                                                                                                                                                            |
| `apps/server/src/modules/imports/undo.ts`                                                                    | Decision 1. `undoImport` new signature (§4). Delete `assertNoOutsideReferences`, `deleteCandidates`, `finishUndo` and the imports of `withTenant`, `fileIdForTickets`, `audit`, `deleteImportedTickets`, `outsideChildRef`, `reportWithFileId`, `markUndone`.                                                                                                                                                         |
| `apps/server/src/modules/imports/security.ts`                                                                | `CliCommand` undo variant gains `operator`; `parseTokens` reads `--operator <text>`; undo without a non-blank operator → `CliUsageError('undo requires --operator')`; import with it → `CliUsageError('--operator applies to undo only')`. New `assertRouterRole`.                                                                                                                                                    |
| `apps/server/src/modules/imports/cli.ts`                                                                     | Usage line `import:undo <batchId> --tenant <slug> --operator <name> [--production-confirm]`. After `assertProductionAccess`, undo goes to a new `runUndo(command)` (no jobs, no `DATABASE_URL`): missing `ROUTER_DATABASE_URL` → `Error('ROUTER_DATABASE_URL is required for import:undo')`; `assertRouterRole`; `resolveTenant`; `undoImport`; prints `{"batchId","deleted"}`; ends its pool. Import path unchanged. |
| `apps/server/src/modules/tickets/repo/imported.ts`                                                           | Delete `outsideChildRef`, `reportWithFileId`, `deleteImportedTickets` (decision 12).                                                                                                                                                                                                                                                                                                                                  |
| `apps/server/src/modules/tickets/index.ts`                                                                   | Delete those three export names.                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/server/src/modules/files/repo.ts`, `index.ts`                                                          | Delete `fileIdForTickets` and its export.                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/server/src/modules/manifest.ts`                                                                        | Decision 11.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/db/test/seed.sql`                                                                                  | Decision 4: both logins `role = 'admin'`; `platform_access` rows gain `approved_by_login_id` (`…0003` per tenant); `ticket_tag` insert deleted. Fake data only.                                                                                                                                                                                                                                                       |
| `packages/db/test/isolation.test.ts`                                                                         | `beforeAll` uses `startMigratedDb()` then `SET ROLE app_user` as today; `DATED_TABLES = {}`; tests 1–4 (§6). **Hook-sensitive, §11.**                                                                                                                                                                                                                                                                                 |
| `packages/db/test/migration-runner.test.ts`                                                                  | `ARTIFACTS['0009_history_cannot_be_lost.sql']` = `SELECT to_regprocedure('import_undo(uuid,text)') IS NOT NULL AND to_regclass('public.ticket_tag') IS NULL AS installed` (the fault-injection test iterates every file); `runMigration(url, adoptThrough?, env = {})`; tests 14, 44–47.                                                                                                                              |
| `apps/server/test/harness.ts`                                                                                | Decision 2: `ROUTER_PASSWORD = 'router-test-password'`; `CREATE ROLE uptimo_router LOGIN PASSWORD …; GRANT app_router, app_user TO uptimo_router`; `TestDb` gains `router`, `routerUrl`; `stop` ends `router`.                                                                                                                                                                                                        |
| `apps/server/test/import-undo.test.ts`                                                                       | Every `undoImport(db.app, t, b)` → `undoImport(db.router, t, b, 'agent-test')`; `seedBatch` stamps `finished_at = clock_timestamp()` after inserting its rows (`UPDATE … RETURNING finished_at`, returned as `finishedAt`); tests 29–33.                                                                                                                                                                              |
| `apps/server/test/import.test.ts` (line 122), `apps/server/test/import-integration.test.ts` (lines 109, 367) | Same call change; test 54 appended to `import-integration.test.ts`.                                                                                                                                                                                                                                                                                                                                                   |
| `apps/server/test/import-cli.test.ts`                                                                        | `runPnpm` also deletes `ROUTER_DATABASE_URL` unless overridden; `runUndo` passes `--operator agent-test` and `ROUTER_DATABASE_URL: options.routerUrl ?? db.routerUrl` (no `DATABASE_URL`); `CommandOptions` gains `routerUrl?`; parse tests add `--operator`; tests 34–38.                                                                                                                                            |
| `tools/migrations.test.ts`                                                                                   | Tests 49–52 appended.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tools/boundaries.test.ts`                                                                                   | Table list without `ticket_tag`, `toHaveLength(28)` (test 53); test 55 added.                                                                                                                                                                                                                                                                                                                                         |

### Deliberately not touched

The migration files; `docs/ARCHITECTURE.md`, `docs/DATA-MAP.md`, D24, `packages/db/README.md` (done in the schema
step); `apps/server/src/seed/cosmos.ts` (`DELETE FROM tenant` as owner still cascades, test 9);
`apps/server/test/history-guard.test.ts`; `infra/` (§12 question 3); `docs/HANDOFF.md`, `docs/spec/parity.yaml`.

## 4. Interfaces

```ts
// scripts/migrate.ts
/** Replaces the one `ALTER ROLE app_router BYPASSRLS;` of 0001 with `NULL;`. Throws
 *  Error('0001: expected exactly one ALTER ROLE app_router BYPASSRLS statement') unless it occurs once. */
export function withoutBypassGrant(sql: string): string;
async function prepareRoles(pool: Pool): Promise<void>; // notes §8 step 1, verbatim
async function canGrantBypass(pool: Pool): Promise<boolean>; // rolsuper OR rolbypassrls of current_user; no row → false
async function revokeLentCreate(pool: Pool): Promise<void>; // REVOKE CREATE ON SCHEMA public FROM app_router
async function secureAppApiRole(pool: Pool): Promise<void>; // full statement only when app_api has rolsuper,
// rolbypassrls or rolreplication; otherwise ALTER ROLE app_api INHERIT NOCREATEDB NOCREATEROLE; nothing if absent
```

```ts
// apps/server/src/modules/imports/repo.ts
export function failBatch(
  tx: Db,
  input: { stats: string; batchId: string; tenantId: string },
): Promise<number | null>;
export function finishBatch(
  tx: Db,
  input: { status: string; stats: string; batchId: string; tenantId: string },
): Promise<void>;
/** SELECT import_undo($1, $2) AS deleted — the definer function of D24. */
export function callImportUndo(tx: Db, batchId: string, operator: string): Promise<number>;

// apps/server/src/modules/imports/batch.ts
export function markBatchFatal(
  pool: Pool,
  tenantId: string,
  batchId: string,
  input: { ticketCount: number; aliasSha256: string; error: unknown },
): Promise<ImportStats>;

// apps/server/src/modules/imports/undo.ts  (re-exported by bhavin.ts as today)
/** `router` connects as a member of app_router and app_user (ROUTER_DATABASE_URL). */
export function undoImport(
  router: Pool,
  tenantId: string,
  batchId: string,
  operator: string,
): Promise<{ deleted: number }>;

// apps/server/src/modules/imports/security.ts
export type CliCommand =
  | { mode: 'import'; file: string; tenantSlug: string; productionConfirm: boolean }
  | {
      mode: 'undo';
      batchId: string;
      tenantSlug: string;
      productionConfirm: boolean;
      operator: string;
    };
/** Query: SELECT current_user AS name, pg_has_role(current_user, 'app_router', 'USAGE') AS router,
 *  pg_has_role(current_user, 'app_user', 'MEMBER') AS app_user. Needs exactly one row, both true, name not
 *  'app_api'; else Error('import:undo requires ROUTER_DATABASE_URL: a login that is a member of app_router and
 *  app_user'). Releases its client; a connect or query failure gives the same error. */
export function assertRouterRole(pool: Pool): Promise<void>;
```

```ts
// scripts/operator-db.ts
/** Pool on MIGRATION_DATABASE_URL (max 1); throws Error('MIGRATION_DATABASE_URL is required'). */
export function operatorPool(): Pool;
/** SELECT id, slug FROM tenant ORDER BY slug */
export function listTenants(pool: Pool): Promise<Array<{ id: string; slug: string }>>;

// packages/db/test/migrated.ts
/** postgres:16-alpine container; migration files in name order up to `through` (default: all), applied raw as
 *  the superuser; installJobSchema; seed.sql when `seed` (default true). Client is the superuser. */
export function startMigratedDb(options?: {
  through?: string;
  seed?: boolean;
}): Promise<{ container: StartedPostgreSqlContainer; client: Client; url: string }>;

// scripts/erase-person.ts
export const HAND_REVIEW: readonly string[]; // the seven places of DATA-MAP §5's last paragraph, one line each
```

**Command lines and output** (exit codes: 0 done, 1 error, 2 usage, 3 review pending):

| Command                                                                                                          | Prints                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsx scripts/preflight-cutover.ts`                                                                               | per tenant: `preflight: <slug>: machine <code>: open breakdowns <ref>, <ref>`, `preflight: <slug>: <n> tag rows to export`, `preflight: <slug>: <n> support grants end at cutover`; last line `preflight: <d> machines with duplicates, <t> tag rows, <g> grants`. Exit 1 when d > 0. Schema absent: `preflight: schema not installed` exit 0                                                                                                                 |
| `tsx scripts/export-tags.ts --out <dir>`                                                                         | `export-tags: <N> rows written to <path>` and `export-tags: migrate with PGOPTIONS='-c uptimo.tags_exported=<N>'`; 0 rows or no table: `export-tags: nothing to export`, no file, exit 0                                                                                                                                                                                                                                                                      |
| `tsx scripts/erase-person.ts --tenant <slug> --person <uuid> --request <ref> --operator <who> --files-dir <dir>` | the function's counts as one JSON line (`s3_keys` removed from it), then `erase: complete` (exit 0) or the `HAND_REVIEW` lines and `erase: review pending: record it with --review-done` (exit 3). Refuses (exit 1) a person not in that tenant, checked under `app.tenant_id` before the call. Before deleting any file it checks every key: one that is absolute or contains `..` prints `erase: unsafe storage key <key>`, exits 1, and no file is deleted |
| `tsx scripts/erase-person.ts --tenant <slug> --review-done --request <ref> --operator <who>`                     | `erase: complete` (exit 0) after writing the review row; exit 1 `no erasure with that request reference`; an already recorded or `text_searched: true` erasure prints `erase: complete` without a new row                                                                                                                                                                                                                                                     |

Database functions: signatures exactly as notes §7; no new endpoint, event or component.

## 5. Data

No schema change in this slice. Fields this slice's code reads or writes:

| Field                                                                                                                             | Type                                                                                                                                                                       | Where                     | This slice                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `import_batch.finished_at`                                                                                                        | timestamptz                                                                                                                                                                | 0001                      | **written** `clock_timestamp()` by `finishBatch`/`failBatch`                       |
| `import_batch.status`, `.stats`, `.source`                                                                                        | text, jsonb, text                                                                                                                                                          | 0001                      | read under `app_user` by `lockBatchRow` (unchanged); written only by `import_undo` |
| everything `import_undo`, `erase_person`, `offboard_tenant`, `audit_purge` touch                                                  | —                                                                                                                                                                          | 0009                      | as notes §7 tables; code only calls them                                           |
| `audit_log` row `person.erase.review`                                                                                             | `tenant_id`, `action`, `entity = 'person'`, `entity_id` (copied from the matched `person.erase` row's `entity_id`), `login_id` NULL, `after jsonb {request_ref, operator}` | 0001 columns              | **written** by `erase-person.ts --review-done`; a new action value, not a column   |
| `audit_log.after->>'request_ref'`, `->>'text_searched'` (action `person.erase`)                                                   | jsonb                                                                                                                                                                      | written by `erase_person` | read by `erase-person.ts --review-done`                                            |
| `ticket_tag.*` (id, tenant_id, ticket_id, item_id, applied_at, applied_by_login_id, applied_by_person_id, created_at, updated_at) | —                                                                                                                                                                          | 0005                      | read by `export-tags.ts`, counted by `preflight-cutover.ts`, before 0009 only      |
| `ticket.tenant_id, machine_id, kind, status, ref`; `machine.code`; `tenant.id, slug`                                              | uuid, uuid, text, text, text; text; uuid, text                                                                                                                             | 0001                      | read by `preflight-cutover.ts`                                                     |
| `platform_access.id, created_at, expires_at`                                                                                      | uuid, timestamptz, timestamptz                                                                                                                                             | 0001                      | counted by `preflight-cutover.ts` (same predicate as 0009 part 5)                  |
| `platform_access.approved_by_login_id`                                                                                            | uuid                                                                                                                                                                       | 0009                      | written by `seed.sql`                                                              |
| `login.role`                                                                                                                      | text                                                                                                                                                                       | 0001                      | written `admin` by `seed.sql`                                                      |

## 6. Test cases

Shorthand: "as `app_api`" = in a transaction `SET LOCAL ROLE app_api` + `app.tenant_id`, rolled back.
**Red first:** tests 29–38, 40–44, 47, 49–52, 54, 55, 56 fail on the branch head (code not written). Tests 46 and 53
are regression guards: they pass once the rest is built and keep the down file and the owner list honest. Tests 1–28, 39 and 45
exercise the committed migration: their red run is on the parent commit `2fe99fa` (no 0009); the coder runs them
there once in a `git worktree` and pastes the failing summary into the PR. Fake names only: the leaver is
`Testa Leaver` (short `Testa`, phone `+910000000099`, username `testa.l`), operator `agent-test`.

### Goal 1 — the database refuses to lose history

`packages/db/test/isolation.test.ts`

1. **`refuses to delete a login that acted on a ticket, and the row remains`** — Given a fresh tenant `3000…01`
   with a person, a non-shared login, a ticket raised by that login and a `ticket_event` it wrote. When the login
   is deleted as `app_user`, then as the owner. Then the first fails `/permission denied/`, the second
   `/foreign key/`, and the login row still exists. (Replaces `preserves a tag assignment…`, §11.)
2. **`refuses to delete a person who appears on a ticket, and the row remains`** — same tenant, the ticket's
   `reported_by_person_id`; same When/Then for `person`.
3. **`enables and forces RLS on every tenant table`** (assertion changed) — Then every tenant table has exactly one
   `tenant_isolation` policy, and `router_definer` exists, `TO app_router`, on exactly the 16 tables of 0009 part 8
   and no other.
4. **`gives neither app_user nor app_router a bypass`** (was `…and app_router bypass`) — Then both `rolbypassrls`
   are `false`.

`packages/db/test/history.test.ts` (`startMigratedDb()`, seed tenants A and B)

5. **`refuses the app role every history delete and event edit`** — Given tenant A's seed rows. When, as
   `app_api`, `UPDATE ticket_event`, `DELETE FROM ticket_event` and `DELETE FROM` each of `ticket`,
   `work_segment`, `crew_member`, `breakdown_report`, `breakdown_report_person`, `list_item`, `login`, `person`,
   `machine`, `machine_move`, `file` run. Then all 13 fail `/permission denied/` and each table still holds A's row.
6. **`still lets the app do what it does today`** — When, as `app_api`, it updates `machine.criticality`, sets
   `list_item.active = false`, inserts a `ticket_event` (seq 2), deletes its `session`, `push_subscription` and
   `command_idempotency` rows. Then each succeeds.
7. **`drops ticket_tag`** — Then `to_regclass('public.ticket_tag')` is null.
8. **`makes the 21 history keys RESTRICT`** — Then `pg_constraint.confdeltype = 'r'` for each name in notes §3.
9. **`still removes a whole customer when the owner deletes the tenant`** — Given a tenant with a person, login,
   machine, ticket, event, crew row and stretch. When the owner runs `DELETE FROM tenant`. Then it succeeds and
   every one of those rows is gone.

`apps/server/test/history-indexes.test.ts` (harness; one tenant, 200 persons, 20,000 closed `stopped` tickets
reported 26 minutes apart from 2026-01-01, one 30-minute `work_segment` and one `down` event per ticket by person
`g % 200`, all via `generate_series` as admin, then `ANALYZE ticket, work_segment, ticket_event`). Each test passes
the real repo function a `Db` whose `query(text, params)` runs `EXPLAIN (FORMAT JSON) ` + text as `app_api`
inside `withTenant`, and searches the plan JSON for `"Index Name"`.

10. **`the day report reaches a person's work through its indexes`** — When `dayJobRows` runs for one person and a
    one-day window. Then the plan names `work_segment_person_idx` and `ticket_event_actor_idx`.
11. **`My complaints reaches a reporter's tickets through ticket_reporter_idx`** — When `selectTicketPage` runs
    with `raisedBy` and `limit: 50`. Then the plan names `ticket_reporter_idx`.
12. **`a date-range list uses ticket_reported_idx`** — When `selectTicketPage` runs with a 7-day `from`/`to`.
    Then the plan names `ticket_reported_idx`.

### Goal 2 — one open breakdown per machine

13. **`refuses a second open breakdown on one machine`** · `history.test.ts` — Given A's open `stopped` seed
    ticket on machine `…08`. When, as `app_api`, a second open `stopped` ticket on that machine is inserted, then
    a `general` one and a `closed` one. Then the first fails `/ticket_open_breakdown_unique/`, the other two
    succeed.
14. **`stops the cutover with the list of duplicate breakdowns`** · `migration-runner.test.ts` — Given a database
    at 0007 (`applyThrough` + `recordThrough`) with two open `stopped` tickets `BD-0001`, `BD-0002` on one
    machine. When `runMigration` runs. Then it rejects, stderr names both refs, the ledger lacks 0009. **And**
    after one is set `cancelled`, `runMigration` succeeds and the ledger equals `FILES`.
15. **`preflight lists duplicates and exits non-zero`** · `cutover-scripts.test.ts` — Given the scripts database
    at 0007 (§ below) with the same two tickets. When `preflight-cutover.ts` runs. Then exit 1 and stdout has
    `machine <code>: open breakdowns BD-0001, BD-0002`. **And** after cancelling one: exit 0, last line
    `0 machines with duplicates, 3 tag rows, 1 grants`. **And** given an empty database, made with
    `CREATE DATABASE empty_preflight` on the client `startMigratedDb` returned, its URL built from the returned
    `url` with `pathname = '/empty_preflight'` (the `withRunnerDatabases` pattern), no migration applied: when
    the script runs on that URL, then exit 0 and `preflight: schema not installed`.

### Goal 3 — the definer functions and support access

`packages/db/test/definer-functions.test.ts` (`startMigratedDb()`; "as router" = `SET LOCAL ROLE app_router`, committed)

16. **`lets only the router role call the five functions`** — Then `has_function_privilege` is false for
    `app_api` and `app_user` and true for `app_router` on all five signatures, and `SELECT import_undo(…)` as
    `app_api` fails `/permission denied for function/`.
17. **`import_undo refuses a blank operator`** — When called as router with `' '`. Then `/operator is required/`.
18. **`erase_person leaves the leaver's name in no DATA-MAP §5 place and writes one count-only audit row`** —
    Given tenant `4000…01` with the leaver (own login and session and push row), a shared floor login whose
    session acts as the leaver, and the name or phone planted in: ticket `problem`, `location`, `close_note`,
    `waiting_spare`, `task_reason`, `overrides` (`{"note":"Testa Leaver","Testa":1}`); `ticket_event.text` and
    `payload`; all six report fields with a signature and a PDF `file`; `import_row.payload`;
    `import_batch.stats.pendingPersons` beside a `completion` object; an `audit_log` row about the person and one
    about something else; another login's `command_idempotency.result`; plus `Testabhai` in one ticket's problem.
    When `erase_person(leaver, 'REQ-1', 'agent-test')` runs as router. Then no text column of those tables and no
    JSON **string value** (`jsonb_path_query(col, 'strict $.**')`) in the tenant matches `\mTesta\M|0000000099`;
    `Testabhai` is unchanged; the key `Testa` keeps value 1; `stats->'completion'` is byte-identical; the person
    is `Former staff` with phone null; the login is `former-<id>`, hash `!`, disabled; the own session and push row
    are gone; the shared session remains with `acting_person_id` null; event, crew and stretch counts are
    unchanged; both `file` rows are gone and their keys are in `s3_keys`; tenant A's `Asha` is untouched; exactly
    one `person.erase` row exists, its `after` holds only counts, `text_searched: true`, `skipped_short_terms`,
    `request_ref`, `operator`, and its text has no `Testa`.
19. **`erase_person refuses without a reference or operator, or with the name in the reference`** — Then three
    calls fail (`/required/`, `/required/`, `/must not hold the name/`) and the person is unchanged.
20. **`erase_person replaces a Gujarati name only as a whole word`** — Given person `ટેસ્ટા` and tickets
    `ટેસ્ટા (ફિટર) આવ્યા` and `ટેસ્ટાભાઈ આવ્યા`. Then the first reads `Former staff (ફિટર) આવ્યા`, the second is
    unchanged.
21. **`erase_person with no searchable term switches the person off and searches no text`** — Given person `Om`
    (no phone, no login) and `Om checked` in a ticket's problem. Then the person is `Former staff`, inactive; the
    ticket is unchanged (same `updated_at`); the audit row has `text_searched: false`, `skipped_short_terms: 1`.
22. **`offboard_tenant refuses without both references and an operator, or while the customer is active`** —
    Then four calls (blank export, blank backup, blank operator, active tenant) fail and the tenant's rows remain.
23. **`offboard_tenant removes a suspended customer's rows and keeps the proof`** — Given tenant `5000…01`
    (slug `leaving`) with rows in person, login, machine, ticket, ticket_event, set `suspended`. When called as
    router with `EXP-1`, `BAK-1`, `agent-test`. Then every tenant table (catalogue query of `isolation.test.ts`)
    has 0 rows of it except `audit_log` with one `tenant.offboard` row whose `after` is
    `{export_ref, backup_ref, operator}`; the tenant row is `offboarded`, slug `offboarded-<id>`; a second call
    fails; a new tenant can take slug `leaving`.
24. **`the app role cannot delete a customer`** — Then `DELETE FROM tenant` as `app_api` fails
    `/permission denied/`.
25. **`audit_purge removes rows over 3 years old and leaves one count row per customer`** — Given two audit rows of
    A and one of B at `now() - 4 years`, and recent rows. When `audit_purge(now() - interval '3 years 1 day',
'agent-test')`. Then it returns 3, the old rows are gone, the recent ones remain, A and B each get one
    `audit.purge` row (`deleted` 2 and 1). **And** a cut-off of `now() - 1 year` and a blank operator are refused.

`packages/db/test/history.test.ts`

26. **`refuses a support grant without an admin approver or longer than 7 days`** — When, as `app_api` in A,
    grants are inserted with no approver, with a technician login (inserted in the same transaction), with
    `expires_at` 8 days out, and with none. Then each fails (`/approver/`, `/approver/`,
    `/platform_access_expiry_window/`, `/null value/`), and one with the admin approver and 1 day succeeds.
27. **`stamps the grant time from the database and allows only shortening`** — Given a grant inserted with
    `created_at = '2020-01-01'`. Then its `created_at` is within a minute of `now()`; extending fails
    `/cannot be extended/`; moving `created_at` fails `/cannot be changed/`; shortening succeeds.
28. **`ties an audit line to the grant it was taken under`** — Then an audit row in A with A's grant id succeeds,
    with B's grant id fails `/foreign key/`, and deleting A's grant as owner then fails `/foreign key/`.

### Goal 3 — import undo through the router

`apps/server/test/import-undo.test.ts`

29. **`T26 stamps finished_at after every row the import wrote`** (regression, red today) — Given the synthetic
    tenant. When `importBhavin(db.app, …, makeSyntheticExport())` finishes. Then the batch's `finished_at` is
    `>=` the greatest `created_at` of its tickets' events, crew rows and stretches.
30. **`T27 undoes a batch the importer has just finished`** (regression, red today) — When `undoImport(db.router,
tenant, batchId, 'agent-test')` follows that import. Then it resolves `{ deleted: <ticket count> }`.
31. **`T21 removes the batch's SLA timers and keeps its import rows while preserving the tenant`** (replaces the
    tag-cascade case, §11) — Given a seeded batch plus an `sla_timer` row for its ticket. When undone. Then the
    timer is gone, the `import_row` remains with `ticket_id` null, the tenant remains.
32. **Existing T21–T25 through the router.** Same Given/When/Then as today with the new call; T25's audit `after`
    becomes `{ status: 'undone', deleted: 0, operator: 'agent-test' }`.
33. **`T28 refuses a batch whose finish time predates its rows`** — Given a seeded batch with `finished_at` set
    back one hour. Then undo fails `/worked on after the import finished/` and the ticket remains.

`apps/server/test/import-cli.test.ts`

34. **`router role guard`** — unit, with a new helper beside `rolePool`:
    `routerRolePool(rows: RouterRoleRow[], error?: Error)`, `interface RouterRoleRow { name: string; router:
boolean; app_user: boolean }`, returning `{ pool, query, release }` exactly as `rolePool` does. It resolves for `{name:'migrator', router:true,
app_user:true}`; rejects `/app_router/` for no row, `app_api`, either membership false, two rows, a query
    error, a connect error; releases the client every time it got one.
35. **`undo stops before database work without ROUTER_DATABASE_URL`** (T16 describe) — When `import:undo <id>
--tenant cosmos --operator agent-test` runs with `APP_ENV=staging` and no router URL. Then exit 1, stderr
    `/ROUTER_DATABASE_URL is required/`.
36. **Usage** — `['import:undo', BATCH_ID, '--tenant', 'cosmos']` (no operator) joins the T16 exit-2 list, and
    `parseCliArgs` refuses `--operator` on import.
37. **`T17 …` undo half** (§11) — When undo runs with `ROUTER_DATABASE_URL` set to the `app_api` URL, and again
    set to the existing `synthetic_bypass` URL (BYPASSRLS, not a member of `app_router`). Then each exits 1,
    stderr `/app_router/`, no batch written and no undo done. An owner or superuser router URL is **accepted by
    design** (decision 2: the router connection is the migration credential; locally that is the superuser), so
    T17's owner-URL undo case is not kept. The import half is unchanged.
38. **`T20 …`** — the audit `after` also carries `operator: 'agent-test'`.

`apps/server/test/import-integration.test.ts`

54. **`T44 undoes a batch whose tickets follow each other`** — Given `importBhavin` of
    `generalTicket({ ref: 'WR-0001', parentRef: 'WR-0002', legacyId: 'child' })` and
    `generalTicket({ ref: 'WR-0002', legacyId: 'parent' })` (as T43). When `undoImport(db.router, …,
'agent-test')`. Then it resolves `{ deleted: 2 }` and neither ref exists. If it fails on
    `ticket_parent_id_fkey`, stop: that is a migration finding (§ header).

### Operator scripts · `packages/db/test/cutover-scripts.test.ts`

Given `startMigratedDb({ through: '0007_sla_policy_timer.sql', seed: false })` plus fake rows: tenants `alpha` and
`beta`, three `ticket_tag` rows (2 + 1), one live `platform_access` grant. Scripts run as `pnpm tsx scripts/…`
subprocesses with `MIGRATION_DATABASE_URL`.

**Order in the file is required** (vitest runs one file's tests in order; they share the database): tests 15 and
39 run **at 0007**; test 39 ends by applying 0009; tests 40, 41, 42, 43, 56 then run **at 0009**. Written in that
order: 15, 39, 40, 41, 42, 43, 56.

39. **`export-tags writes every row and its count opens the guard`** — When run with `--out <mkdtemp>`. Then
    exit 0; stdout says 3 rows; the file has the header and 3 lines holding each tag id; **and** 0009 applied raw
    on a client with `SET uptimo.tags_exported = '3'` succeeds.
40. **`export-tags has nothing to export after the cutover`** — Then exit 0, `nothing to export`, no new file.
41. **`erase-person completes a searchable erasure and deletes the stored files`** — Given the leaver of test 18
    (fewer places: one ticket, one report with a PDF `file` whose key exists under the `--files-dir`). Then exit 0,
    `erase: complete`, the key's file is gone, the ticket problem no longer holds the name.
42. **`erase-person holds a no-term erasure until the review is recorded`** — Given person `Om`. Then exit 3,
    stdout has every `HAND_REVIEW` line and `review pending`; **then** `--review-done --request REQ-2` exits 0
    with `erase: complete` and one `person.erase.review` row; a second `--review-done` adds no row.
43. **`erase-person refuses bad input`** — Then a missing `--operator` exits 2 with usage, and a person of `beta`
    given `--tenant alpha` exits 1 and the person is unchanged.
44. **`erase-person refuses an unsafe storage key and deletes nothing`** (at 0009) — Given a leaver of `alpha`
    with two reports whose PDF `file` rows have `s3_key = '../outside.pdf'` and a safe key, a file `outside.pdf`
    in the parent of the `--files-dir` and the safe key's file inside it. When `erase-person.ts` runs. Then exit
    1, stderr `erase: unsafe storage key ../outside.pdf`, and both files still exist (all keys are checked before
    any is deleted). The same rule refuses an absolute key.

### The migration runner · `packages/db/test/migration-runner.test.ts`

44. **`runs every migration as a non-superuser database owner`** — Given its own container, a role
    `uptimo_master LOGIN CREATEROLE CREATEDB PASSWORD UPTIMO_MASTER_PASSWORD` (a constant in the test file,
    `const UPTIMO_MASTER_PASSWORD = 'master-test-password'`, fake) owning a new database. When `runMigration` runs on its URL. Then it
    succeeds; the ledger equals `FILES`; `app_router` has no BYPASSRLS and no CREATE on `public`;
    `uptimo_master` is a member of `app_router`; `app_api` is clean as in the existing test; and
    `SELECT audit_purge(now() - interval '4 years', 'agent-test')` as `uptimo_master` returns 0.
45. **`stops the cutover while tags are unexported`** — Given 0007 + one tag row. Then `runMigration` rejects
    `/ticket_tag holds 1 rows/`; with `PGOPTIONS='-c uptimo.tags_exported=2'` rejects; with `=1` succeeds and the
    table is gone.
46. **`goes up, down and up again`** — Given a fully migrated database. When the down file is applied raw, the
    0009 ledger row deleted and `runMigration` run again. Then after the down `ticket_tag` exists and `app_user`
    may `DELETE` on `ticket`; after the second up neither holds.
47. **`withoutBypassGrant swaps exactly one statement`** (no container) — Then the real 0001 text loses its one
    occurrence and gains `NULL;`; a text without it and a text with two both throw.
48. The existing fault-injection test now covers 0009 through the new `ARTIFACTS` entry; no other existing case
    changes.

### The migration check · `tools/migrations.test.ts`

49. **`catches statements hidden by block comments`** — `UPDATE ticket/**/SET severity = 'S4';` → `UPDATE`;
    `DELETE/**/FROM ticket;` → `DELETE FROM`; `/* one\ntwo */ DROP TABLE x;` → `DROP` on line 2.
50. **`does not let -- inside a string hide the rest of the line`** — `SELECT '--'; DROP TABLE ticket;` →
    `DROP`; and `-- don't\nDROP TABLE x;` → `DROP` on line 2 (an apostrophe in a comment opens no string).
51. **`catches UPDATE ONLY t * SET`** → `UPDATE`.
52. **`leaves comments and strings that only mention a keyword alone`** — `/* drop later */` and
    `SELECT 'a -- b';` → `[]`. Test 17 of slice 06 (real directory passes, exceptions exact) must stay green.
53. **`gives every current table exactly one owner`** · `tools/boundaries.test.ts` — the list without
    `ticket_tag`, length 28 (regression guard).
54. **`owns no dropped table`** · `tools/boundaries.test.ts` (new, red until `manifest.ts` changes) — Given
    `OWNERS`. Then `Object.values(OWNERS).flat()` does not contain `ticket_tag`, and contains `import_undo`,
    `erase_person`, `erase_json_values`, `offboard_tenant`, `platform_access_guard` and `audit_purge` exactly once
    each.

### Gates

`pnpm verify` green; `pnpm boundaries` at **0 problems** (SQL on a module's tables only in its `repo.ts` or
`repo/`; `import_undo` is called only from `imports/repo.ts`; `scripts/` and package tests are outside the scan);
`pnpm migrations:check` and `pnpm migrations:immutable` (0009 untouched); `pnpm pii:scan`; `pnpm size`.

## 7. How to run, order of work, sizes

**Docker.** Everything that touches a database uses Testcontainers `postgres:16-alpine` (Docker): tests 1–48.
Tests 47, 49–53 and 55 need no database and run in the stop hook's fast set (`tools`). No test uses a plain local
Postgres. Without Docker the coder cannot see the database tiers go green; they run in CI on every PR, and the PR
must not be marked ready until that CI job is green.

**Order** (each step: write its tests, see them red, make them green, run that file):

1. `tools/check-migrations.ts` + tests 49–52.
2. `scripts/migrate.ts` + tests 44–48 (if test 44 fails inside a migration file or pg-boss's install, stop: §2).
3. `seed.sql`, `migrated.ts`, `isolation.test.ts` (tests 1–4).
4. `history.test.ts` (5–9, 13, 26–28), then `definer-functions.test.ts` (16–25).
5. Importer clock (`repo.ts`, `batch.ts`, `bhavin.ts`) + harness router + test 29.
6. Undo through the router (`undo.ts`, `repo.ts`, `security.ts`, `cli.ts`) + tests 30–38, 54 and the call changes in
   `import.test.ts`, `import-integration.test.ts`.
7. Dead code (decision 12), `manifest.ts`, tests 53, 55; `pnpm boundaries`.
8. `history-indexes.test.ts` (10–12).
9. `operator-db.ts`, `preflight-cutover.ts`, `export-tags.ts`, `erase-person.ts` + tests 15, 39–43, 56.
10. Changelog fragment; full `pnpm verify`; the red run on `2fe99fa` for §6's migration tests.

**Sizes** (budget 400 per source file, tests and migrations excluded): `scripts/migrate.ts` 178 → about 235;
`check-migrations.ts` 101 → about 135; `undo.ts` 176 → about 140; `security.ts` 103 → about 135; `cli.ts` 78 →
about 100; `imports/repo.ts` 138 → about 130; `imported.ts` 224 → about 180; `erase-person.ts` about 170. None
near 400; no `lean-allow`. 0009 is 555 lines: migrations are exempt from the line budget (LEAN §2), nothing to do.
Functions stay under 60 lines (split `runUndo` out of `cli.main`, the role helpers out of `applyAppMigrations`).

## 8. Out of scope

- Any change to 0009 or its down file.
- An offboarding script (export, storage prefix, queued jobs) and an `audit.purge` script or schedule: the
  functions are built and tested; their operator scripts are follow-ups.
- S3 deletion of erased files (no S3 adapter exists; decision 8).
- `infra/instance/refresh-env.sh` and the `uptimo/staging` secret (§12 question 3).
- Mapping a raise race's unique violation to the "already open" reply (§12 question 2).
- The lead-person filter rewrite and its two indexes (notes open question 6).
- `ai_suggestion` (PR #158) and `erase_person` for it (notes open question 5).

## 9. Changelog fragment

`changes/85-history-cannot-be-lost.md`:

```
- The database refuses to delete or rewrite ticket history, people, logins, machines and files.
- A machine can have only one open breakdown at a time.
- A leaver's name can be erased everywhere it appears, without deleting any history.
- A customer can be removed only with an export and a backup on record.
- Support access needs a customer admin's approval and ends within 7 days.
```

## 10. Regression risks and their guards

| Risk                                                                               | Guard                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in and SLA discovery now depend on `router_definer` policies, not BYPASSRLS   | `auth.test.ts`, isolation `resolves the tenant by slug…`, `discovers policy tenants…`, `sla-timers.test.ts`                                                              |
| A raise race now ends in a unique violation (500) instead of a silent duplicate    | Not fixed here (§12 q2); the non-race path keeps its reply (existing `tickets.test.ts` duplicate case)                                                                   |
| A test fixture inserts two open breakdowns on one machine and now fails            | Whole suite in CI. The coder may change only that fixture row's `machine_id` or `status` when the test is not about duplicates, and lists each in the PR; otherwise stop |
| An undo of a batch with parent links inside it trips the self-referencing RESTRICT | Test 54 (no existing test undoes such a batch)                                                                                                                           |
| `DELETE FROM tenant` in tests and the Cosmos seed                                  | Test 9; every server suite's `beforeEach`; `cosmos-seed.test.ts`                                                                                                         |
| The new scanner changes findings on merged files                                   | Slice 06 test 17 (real directory passes)                                                                                                                                 |
| The runner's lent CREATE stays on `app_router` after a failed run                  | Test 44 (success path); failure path revokes with its error swallowed                                                                                                    |
| The importer's `failed` batches lose their finish time                             | `import-integration.test.ts` fatal case (`finished_at` is a Date), test 29                                                                                               |

## 11. Test edits the harness hook may block

The hook blocks deleting, skipping or weakening tests. These edits are required; if the hook blocks one, **stop
and ask the orchestrator for that edit**, do not work around it:

1. `isolation.test.ts` `preserves a tag assignment when its login and person are deleted` → tests 1–2. **The
   intended replacement** (the old "nulls a reference" assertions; the table and the SET NULL keys are gone).
2. `isolation.test.ts` policy-count assertion and `gives app_user no bypass and app_router bypass` → tests 3–4
   (stricter: names and roles of every policy).
3. `import-undo.test.ts` `T21 cascades ticket tags on undo…` → test 31 (the table is gone).
4. `import-cli.test.ts` T17's undo assertions → test 37 (undo no longer reads `DATABASE_URL`).
5. `tools/boundaries.test.ts` 29 → 28 tables (test 53).

Items 2–5 were not in the orchestrator's first list; each is forced by the dropped table or the new undo path,
and the orchestrator has since confirmed all five. Per replaced test, the new one asserts the new rule at least as
strictly as the old one asserted the old rule:

1. Old: one delete as `app_user`, two column values checked. New: two refusals per table (privilege and
   RESTRICT) and the row still present, for both login and person.
2. Old: one policy per table, one attribute pair. New: the exact policy names per table and their role, and both
   attributes; any extra, missing or widened policy fails.
3. Old: the tag rows go with the ticket and the tenant stays. New: the timer goes with the ticket, the import row
   stays with its link emptied, and the tenant stays.
4. Old: an owner URL and a BYPASSRLS URL are refused for undo. New: the `app_api` URL and the BYPASSRLS URL are
   refused by a membership check that refuses every non-member login; the owner URL is the intended credential
   (test 37).
5. Old: 29 tables, one owner each. New: 28 tables, one owner each, plus test 55 (no dropped table owned, each
   function owned once).

## 12. Questions for the orchestrator (none for Nimish)

**Plan review:** `plan-reviewer` FAIL with 8 text gaps (unsafe storage key, empty-database Given, scripts-test
order, review-row `entity_id`/`login_id`, test-44 password constant, red-first accounting and the `OWNERS`
assertion, test 37's accepted owner URL and kept BYPASSRLS refusal, test 34's helper type). All fixed in this text;
no design change; no second round, by orchestrator ruling. That ruling also answers questions 1 and 4 below.

1. Confirm §11 items 2–5 as permitted replacements.
2. The raise race: map a `ticket_open_breakdown_unique` violation to today's "already open" reply in this slice,
   or a follow-up ticket? Planned: follow-up.
3. `infra/instance/refresh-env.sh` could write `ROUTER_DATABASE_URL=` from the existing `MIGRATION_DATABASE_URL`
   into `migrate.env` (one line, plus its `tools/staging-deploy.test.ts` expectation), so no new secret is needed.
   Notes §8 left `infra/` to ticket 13's owner. Planned: not in this slice; the PR body says how to set it.
4. Offboarding and purge operator scripts: confirm they are follow-ups (decision 13).

## 13. PR body for Nimish (plain English)

- **What changed for a user:** nothing on screen. Underneath, history can no longer be deleted or rewritten, even
  by a bug in the app. A machine can have only one open breakdown at a time.
- **Leavers (DATA-MAP §5):** on request, a leaver's name becomes "Former staff" on every ticket, report, history
  line and import record; their logins are switched off and their own devices signed out; a shared floor phone
  stays signed in. If their name is only one or two letters, the tool switches them off at once and prints the
  list of places the plant must check by hand; the request is not marked complete until that check is recorded.
- **A customer who leaves (question 25, the default you approved):** everything of theirs is deleted except their
  own record, kept as "left" with its name, language, time zone and plan, and one audit line holding the export and
  backup references and who did it. _Your call:_ should the customer's name also be blanked on that record?
- **Support access:** needs a customer admin's approval and ends within 7 days; every existing grant was ended at
  the cutover, each change written to the audit trail.
- **Tags:** removed. Staging has none; on a database that holds tags, the export (`tsx scripts/export-tags.ts
--out <backup folder>`) writes `ticket_tag-<date>.csv` beside the backup, and the migration will not run until
  that export's count is given.
- **Staging, in order:** (1) backup first: `aws rds create-db-snapshot --db-instance-identifier uptimo-postgres
--db-snapshot-identifier uptimo-pre-0009-<date>`, then `aws rds wait db-snapshot-available …`; send the
  identifier. (2) `ROUTER_DATABASE_URL` goes in `migrate.env` only, set to the same value as
  `MIGRATION_DATABASE_URL`; never in `app.env` (the running server must not have it). (3) `gh workflow run
deploy.yml`, `gh run watch`. (4) open `site_url/api/v1/health`, expect `{"status":"ok"}`. If step 3 stops at
  "migration failed", nothing changed; send the log line.
- **Not yet proven on real RDS** (notes §8): whether RDS's master behaves like the stand-in owner used in CI (test
  44), pg-boss's install as that user, and `pgcrypto`. Test 44 covers the stand-in; staging is the first real run.
- **Schema review:** PASS-with-conditions after 3 rounds; conditions were documentation and are applied.
- **Tests that prove it:** §6 numbers 1–56; how to try it: nothing to click; the health check above.
