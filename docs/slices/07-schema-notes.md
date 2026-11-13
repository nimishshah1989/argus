# Ticket 07 — History cannot be lost: schema design notes

GitHub #85 · Architect draft for the `schema-reviewer` · ARCHITECTURE §9 items 21, 24, 25, 27, 31, 33 · D23.
Draft files: `packages/db/migrations/0009_history_cannot_be_lost.sql` and
`packages/db/migrations/down/0009_history_cannot_be_lost.down.sql`. No app code, test or script is written here;
§9 and §10 say what the slice plan must name.

**Number.** `0009`, because open PR #158 holds `0008_ai_suggestion.sql`. The runner applies by name and skips
what its ledger holds, so either merge order works. Neither file depends on the other (see open question 3).

**No new table.** `ticket_tag` goes: 29 tables become 28, as D17 counts. Nothing here needed a table.

## 1. What the migration does, in order

| Part | Change                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| top  | `SET LOCAL row_security = off`; FORCE lifted on the 12 tables the file reads, rewrites or re-validates (D23 pt 5) |
| 1    | Two guards that stop everything: unexported tags; more than one open breakdown on a machine                       |
| 2    | `app_router` loses BYPASSRLS where it has it                                                                      |
| 3    | `DROP TABLE ticket_tag`                                                                                           |
| 4    | 20 foreign keys become `ON DELETE RESTRICT`                                                                       |
| 5    | Support access: expiry backfilled with a trace, then required and capped at 7 days; approver; audit link          |
| 6    | Four indexes and the partial unique index                                                                         |
| 7    | Revokes on `app_user`; grants and `router_definer` policies for `app_router`                                      |
| 8    | The four definer functions                                                                                        |
| 9    | FORCE put back on the 11 remaining tables                                                                         |

One transaction. A failed guard or statement leaves the database exactly as it was, so the grant changes are never
half-applied (item 25).

## 2. Grants (item 21)

Revoked from `app_user`, and so from `app_api`, which has no grants of its own:

- `UPDATE, DELETE` on `ticket_event`
- `DELETE` on `ticket`, `work_segment`, `crew_member`, `breakdown_report`, `breakdown_report_person`, `list_item`,
  `login`, `person`

Still deletable by the app, on purpose: `session` (sign-out, `session.purge`), `push_subscription` (unsubscribe),
`command_idempotency` (`idempotency.purge`), and the configuration tables. `tenant` was never granted.

## 3. Foreign keys

**Changed to RESTRICT (20).** Each is dropped and re-added with the same name, columns and target; names read from
`pg_constraint` after applying 0001–0007.

| Table                     | Constraint                                     | Was      |
| ------------------------- | ---------------------------------------------- | -------- |
| `login`                   | `login_person_id_fkey`                         | SET NULL |
| `ticket`                  | `ticket_reported_by_person_id_fkey`            | SET NULL |
| `ticket`                  | `ticket_raised_login_id_fkey`                  | SET NULL |
| `ticket`                  | `ticket_lead_person_id_fkey`                   | SET NULL |
| `ticket`                  | `ticket_transfer_to_person_id_fkey`            | SET NULL |
| `ticket`                  | `ticket_paused_by_person_id_fkey`              | SET NULL |
| `ticket`                  | `ticket_assigned_to_person_id_fkey`            | SET NULL |
| `ticket`                  | `ticket_closed_by_person_id_fkey`              | SET NULL |
| `ticket`                  | `ticket_parent_id_fkey`                        | SET NULL |
| `ticket_event`            | `ticket_event_ticket_id_fkey`                  | CASCADE  |
| `ticket_event`            | `ticket_event_login_id_fkey`                   | SET NULL |
| `ticket_event`            | `ticket_event_acting_person_id_fkey`           | SET NULL |
| `crew_member`             | `crew_member_ticket_id_fkey`                   | CASCADE  |
| `work_segment`            | `work_segment_ticket_id_fkey`                  | CASCADE  |
| `breakdown_report`        | `breakdown_report_ticket_id_fkey`              | SET NULL |
| `breakdown_report`        | `breakdown_report_submitted_by_person_id_fkey` | SET NULL |
| `breakdown_report_person` | `breakdown_report_person_report_id_fkey`       | CASCADE  |
| `file`                    | `file_ticket_id_fkey`                          | SET NULL |
| `file`                    | `file_uploaded_by_fkey`                        | SET NULL |
| `audit_log`               | `audit_log_login_id_fkey`                      | SET NULL |

Two go beyond the ticket's list, both by the same rule: `login_person_id_fkey` (a login that silently loses its
person changes who "acted" on every event it wrote) and the two `file` keys (a photo or PDF that loses its ticket is
lost evidence). Neither can fire from the app once the deletes are revoked; they close the owner's path too.

The four `ticket_tag` keys go with the table. The composite `(tenant_id, …)` keys were already NO ACTION and are
untouched.

**Left alone, and why.**

| Key                                                               | Stays               | Reason                                                                                                                                |
| ----------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| every `…_tenant_id_fkey` → `tenant`                               | CASCADE             | Offboarding is one `DELETE FROM tenant`. `app_user` has no right on `tenant`, so only `offboard_tenant` and the owner can start it    |
| `session_login_id_fkey`, `push_subscription_login_id_fkey`        | CASCADE             | Not history; the app deletes these rows itself. A login can no longer be deleted by the app, so the cascade fires only in offboarding |
| `session_acting_person_id_fkey`, `push_subscription_acting_…fkey` | SET NULL            | Same                                                                                                                                  |
| `import_row_ticket_id_fkey`                                       | SET NULL            | Import bookkeeping. Only `import_undo` deletes a ticket, and an undone row with an empty ticket link is the correct record            |
| `sla_timer_ticket_tenant_fk`                                      | CASCADE             | A timer is a projection rebuilt from events (0007), not history; it must go with its ticket in `import_undo`                          |
| `ticket_machine_id_fkey`                                          | SET NULL            | Not in item 21. `breakdown_report.machine_id` is already RESTRICT and no route deletes a machine. Open question 4                     |
| `machine_move`, `machine`, `machine_group` → their parents        | as built            | Configuration                                                                                                                         |
| `ai_suggestion` keys (PR #158, not on main)                       | as PR #158 has them | The table may not exist when 0009 runs. Open question 3                                                                               |

**Measured, and it corrects an assumption in the ticket text.** RESTRICT on the history keys does not stop a tenant
cascade. PostgreSQL queues the checks raised by cascaded deletes and runs them after every cascade of the outer
statement has finished. `DELETE FROM tenant` therefore still removes a whole customer, as superuser and as a
non-superuser owner (both run, §11). So existing tests and the Cosmos seed that delete a tenant as the owner keep
working, and `offboard_tenant` is a single delete rather than a hand-ordered list that every new table would have to
join.

## 4. Tags (item 27)

- `scripts/export-tags.ts` (to write, §10) exports every row to `ticket_tag-<utc>.csv` beside the backup and prints
  the row count N. It is a file, not a table.
- The migration counts the rows itself. If the count is above zero it runs only when the session carries
  `uptimo.tags_exported` equal to that count, set with `PGOPTIONS='-c uptimo.tags_exported=N'` (`pg` 8 reads
  `PGOPTIONS`; checked in `node_modules/pg/lib/connection-parameters.js`). Otherwise `RAISE EXCEPTION`.
- **Why the count and not `'yes'`:** on RDS the owner is filtered by row security, so an export script with a
  mistake sees 0 rows and writes an empty file. "Yes" would then drop real rows. A count that must match what the
  migration sees cannot be satisfied by an export that saw nothing.
- No deployed database holds tags: staging has never completed a migration and there is no production. The flag
  matters for developer databases and for the test.

Rejected: an archive table (D17, and the ticket forbids it); copying the tags into `ticket_event` (rewrites history
to keep data the product decided to drop); a boolean flag (above).

## 5. Indexes (items 24, 25)

| Index                                                                   | Query that uses it (measured with `EXPLAIN ANALYZE`, 60,000 tickets, as `app_api`)       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ticket_reported_idx (tenant_id, reported_at)`                          | `selectTicketPage` with `from`/`to` (`tickets/repo/list.ts`)                             |
| `ticket_reporter_idx (tenant_id, reported_by_person_id, reported_at)`   | `selectTicketPage` with `raisedBy` (My complaints)                                       |
| `work_segment_person_idx (tenant_id, person_id, started_at)`            | `dayJobRows`, both `work_segment` branches (`tickets/repo/history.ts`: day report, Team) |
| `ticket_event_actor_idx (tenant_id, acting_person_id, at)`              | `dayJobRows`, the `ticket_event` branch                                                  |
| `ticket_open_breakdown_unique (tenant_id, machine_id) WHERE …` (unique) | The rule itself; also serves `openDuplicateId`, whose predicate it copies word for word  |
| `audit_log_platform_access_idx (tenant_id, platform_access_id) WHERE …` | "What was done under this grant", and the RESTRICT check when a grant is deleted         |

**Not added: `ticket (tenant_id, lead_person_id)`.** The filter is
`lead_person_id = $p OR EXISTS (SELECT … FROM crew_member …)`. PostgreSQL cannot use an index for one arm of an OR
whose other arm is a subquery: with a trial index in place the plan stayed a sequential scan of `ticket` (about
300 ms at 60,000 tickets, the same as without it). The index would be dead weight. The fix is in code: write the
filter as a UNION of two indexed arms; that slice then adds this index and `crew_member (tenant_id, person_id)`
together. Open question 5.

The unique index predicate is `kind <> 'general' AND status NOT IN ('closed', 'cancelled')`. A row with no machine
is never a duplicate (NULLs are distinct).

**Guard and preflight (item 25).** The migration aborts with the list of tenant, machine and ticket refs (refs are
not personal data). `scripts/preflight-cutover.ts` runs the same query before anyone starts, so the person resolves
duplicates through `correct` or `cancel` first. Nothing is fixed automatically.

## 6. Support access (item 31)

| Change                                                              | Detail                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `platform_access.expires_at` NOT NULL                               | After the backfill below                                                                             |
| `platform_access_expiry_window`                                     | `CHECK (expires_at <= created_at + interval '7 days')`; there is no `granted_at`, `created_at` is it |
| `platform_access.approved_by_login_id` + composite key to `login`   | RESTRICT                                                                                             |
| `platform_access_approver_required`                                 | `CHECK (approved_by_login_id IS NOT NULL) NOT VALID`                                                 |
| `audit_log.platform_access_id` + composite key to `platform_access` | RESTRICT; needs the new `platform_access_tenant_id_unique (tenant_id, id)`                           |

**Existing rows.** No row is deleted.

- Expiry empty, or later than 7 days after the grant: set to `created_at + 7 days`. That only ever shortens access.
  Each changed row first gets an audit line, action `migration.0009.platform_access_expiry`, with the old and new
  value (DATA-MAP §6 rule 3), and the down file restores from those lines.
- Approver: left empty. There is no truthful value to fill in. `NOT VALID` means PostgreSQL enforces the rule on
  every insert and every later update, and does not judge the rows that predate it. A plain `NOT NULL` would have
  needed an invented approver.

Rejected: backfilling the approver with the tenant's first admin (a false record); deleting grants without an expiry
(loses rows); a nullable approver enforced only in code.

The table is "built, not used yet"; the seed is the only writer.

## 7. The four definer functions

All: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`, owner `app_router`,
`REVOKE ALL … FROM PUBLIC`, no other grant. Measured: `app_api` gets `permission denied for function` on each.
Model and rejected alternatives: D23.

Manifest owners for the slice plan: `import_undo` → imports; `erase_person`, `offboard_tenant` → identity;
`audit_purge` → ops.

### `import_undo(p_batch_id uuid) RETURNS integer`

Replaces `deleteImportedTickets` and `markUndone` plus the audit write in `imports/undo.ts`. The tickets come from
the batch's own `import_row` rows, never from the caller.

Refuses unless: the batch exists with `source = 'bhavin'` and status `done` or `failed`; `stats.completion.tickets`
is an array; the imported rows and that fingerprint name the same tickets; every ticket has `raised_channel` in
(`import`, `backfill`); no ticket outside the set has a parent inside it; no `file` points at a ticket of the set
and no report of the set has a signature or PDF. These are today's checks in `undo.ts`, repeated where they cannot
be skipped. The content comparison (`assertCompletion`) stays in `undo.ts`, before the call.

| Table                     | Rows touched                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `import_batch`            | The one batch: locked, then `status = 'undone'`                                                  |
| `breakdown_report_person` | Deleted: rows of reports on the batch's tickets                                                  |
| `breakdown_report`        | Deleted: reports on the batch's tickets                                                          |
| `work_segment`            | Deleted: the batch's tickets                                                                     |
| `crew_member`             | Deleted: the batch's tickets                                                                     |
| `ticket_event`            | Deleted: the batch's tickets                                                                     |
| `ticket`                  | Deleted: the batch's tickets; the count must equal the set or everything rolls back              |
| `sla_timer`               | Deleted by the existing cascade from `ticket`                                                    |
| `import_row`              | `ticket_id` emptied by the existing SET NULL; the rows stay                                      |
| `audit_log`               | One row, `import.undo`: before = status, fingerprint digest, ticket ids; after = `undone`, count |

### `erase_person(p_person_id uuid, p_request_ref text) RETURNS jsonb`

Deletes no history row. Search terms are the person's name, short name, mobile number and the usernames of their
own (not shared) logins, matched as whole words, case-insensitively, any run of spaces matching any run of spaces.
Returns the counts plus `s3_keys`, the storage objects the calling script must delete.

Refuses when: the reference is empty; the reference contains one of the terms (so a name cannot reach the audit
row); a term holds a quote or backslash (it could not be replaced safely inside stored JSON).

DATA-MAP §5, place by place:

| §5 place                      | Table: what happens                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The person                    | `person`: `name = 'Former staff'`; `short_name`, `phone`, `title`, `default_shift` emptied; `active = false`                                                                                                 |
| Their logins                  | `login` where `person_id` is the person: `username = 'former-<login id>'`, `password_hash = '!'` (not a hash, so nothing verifies), `disabled_at` set if empty                                               |
| Devices, push registrations   | `session`, `push_subscription`: deleted where the login is theirs or `acting_person_id` is the person. WhatsApp contact is `person.phone` (D17), emptied above                                               |
| Breakdown report typed fields | `breakdown_report`: terms replaced in `problem`, `observed_by`, `corrective_action`, `spare_used`, `root_cause`, `handover_name`                                                                             |
| Ticket text                   | `ticket`: terms replaced in `problem`, `close_note`, `waiting_spare`, and also `task_reason` and `overrides` (free text §5 does not name)                                                                    |
| Ticket history                | `ticket_event`: terms replaced in `text` and `payload`. The one permitted edit of history                                                                                                                    |
| Import rows                   | `import_row`: `payload = '{}'` on every row of the tenant whose payload holds a term                                                                                                                         |
| Audit before and after        | `audit_log`: on rows about this person or their logins every stored value is blanked and the field names kept; on every other row of the tenant the terms are replaced                                       |
| Signature images              | `breakdown_report.signature_file_id` emptied where `handover_name` held a term; the `file` row deleted; key returned                                                                                         |
| Repeat guard                  | `command_idempotency`: `result = '{}'` where the login is theirs or the stored reply holds a term. The row stays, so the key still blocks a replay                                                           |
| (not in §5) saved report PDFs | Every `breakdown_report.pdf_file_id` of the tenant emptied, `qr_payload = '{}'`, the `file` rows deleted, keys returned. A PDF bakes in names and is re-made on the next request. DATA-MAP §5 gains this row |
| Audit of the erasure          | One `audit_log` row, `person.erase`: `after` = one count per table and the request reference. No name, no text, no ids of changed rows                                                                       |

Decisions inside it:

- **Whole words, failing towards erasing more.** The boundary is "the neighbour is not a letter or digit" written
  as a lookaround, not `\m…\M`. Under a C locale `\m` never matches before a Gujarati letter, which would leave the
  name in place; the lookaround replaces it (measured with a Gujarati name). "Ashok" survives the erasure of "Asha".
- **Terms under three characters are not searched** and are counted in `terms_too_short`. "RP" would rewrite
  ordinary text. They join the nicknames the plant reviews by hand (DATA-MAP §5).
- **All of the plant's cached PDFs go, not only the leaver's.** Which names a PDF shows depends on the template,
  which will change; "all" cannot go stale, and the cost is a re-render. Only `file` rows a report points at are
  deleted, so a future manual stored as a PDF is safe.
- **`updated_at` is bumped** on changed tickets and reports, so a device holding an offline copy fetches the cleaned
  text. Side effect: those tickets rise in lists ordered by last change.
- **Running it twice is harmless.** The second run finds nothing and writes a second audit row of zeros.
- **Counts, not record ids.** DATA-MAP §5 said the audit trail records "which records and which fields". The ticket
  asks for counts only; §5 is reworded to match. Open question 6.
- **Later tables extend the function** with `CREATE OR REPLACE` in their own migration: `ai_suggestion` (PR #158),
  `notification`, `wa_message`.

### `offboard_tenant(p_tenant_id uuid, p_export_ref text, p_backup_ref text) RETURNS void`

Refuses when either reference is empty or blank, when the tenant does not exist, and when its status is not
`suspended`. Then `DELETE FROM tenant WHERE id = …`: the `ON DELETE CASCADE` keys from every tenant table remove
all of that customer's rows, in every table that carries `tenant_id`, including tables added later. It writes
`RAISE LOG` with the tenant id and both references to the database log.

- **Suspend first** is an interlock against a mistyped id: suspending also stops sign-in (`tenant_by_slug` answers
  only for active tenants).
- **No audit row.** The customer's audit trail is deleted with the customer, and there is no cross-tenant table to
  hold one (D17). The record is the database log line and the operator's offboarding note. Question 25 in DATA-MAP.
- The script that calls it also deletes the tenant's storage prefix and queued jobs; neither is in the database
  schema this ticket owns.

### `audit_purge(p_older_than timestamptz) RETURNS bigint`

Refuses a NULL cut-off or one newer than `now() - 3 years`. Deletes `audit_log` rows with `at < p_older_than`,
across tenants. Returns the count.

## 8. RDS

**Measured** on `postgres:16-alpine` with a non-superuser `LOGIN CREATEROLE CREATEDB` role that owns the database
(the closest local stand-in; ticket 13 used the same):

| Statement                                                               | Result                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `CREATE ROLE app_router NOLOGIN BYPASSRLS` (0001:13)                    | refused: only a BYPASSRLS role may create one                                    |
| `ALTER ROLE app_router BYPASSRLS` (0001:15)                             | refused, same reason                                                             |
| `ALTER ROLE app_router NOBYPASSRLS`                                     | refused too, hence the `IF` in part 2                                            |
| `ALTER FUNCTION … OWNER TO app_router`                                  | needs membership of `app_router` **and** `app_router` to hold CREATE on `public` |
| `ALTER ROLE app_api … NOSUPERUSER NOBYPASSRLS … NOREPLICATION` (runner) | refused: naming SUPERUSER at all needs a superuser                               |
| `ALTER ROLE app_api INHERIT NOCREATEDB NOCREATEROLE`, `LOGIN PASSWORD`  | allowed                                                                          |
| owner reads a FORCE row-security table                                  | 0 rows, silently; with `row_security = off`, an error                            |
| owner re-adds a foreign key on such tables with `row_security = off`    | error from the validation query, hence FORCE is lifted on both sides             |
| 0001 (one statement skipped) to 0007, then 0009, then down, then 0009   | all pass as that role                                                            |

**Not verifiable from here** (no RDS access): whether `rds_superuser` may grant BYPASSRLS; whether RDS's master
differs from a plain CREATEROLE owner in any statement above; that pg-boss's own install passes as the master
(it needs only CREATE on the database, which the owner has); `pgcrypto` on RDS (a trusted extension since
PostgreSQL 13). The design needs none of the uncertain rights: no role attribute is asked for anywhere.

**Runner changes, `scripts/migrate.ts`** (for the slice plan; not written here):

1. `prepareRoles(pool)`, after the advisory lock and before anything else:

   ```sql
   DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_router') THEN
       CREATE ROLE app_router NOLOGIN;
     END IF;
     IF NOT pg_has_role(current_user, 'app_router', 'SET') THEN
       EXECUTE format('GRANT app_router TO %I', current_user);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
       CREATE ROLE app_user NOLOGIN;
     END IF;
     IF NOT pg_has_role(current_user, 'app_user', 'SET') THEN
       EXECUTE format('GRANT app_user TO %I', current_user);
     END IF;
   END $$;
   GRANT CREATE ON SCHEMA public TO app_router;
   ```

   and, in a `finally` after the last file: `REVOKE CREATE ON SCHEMA public FROM app_router`. For a superuser
   both `pg_has_role` tests are already true, so local and CI databases change only by the lent CREATE.

2. For `0001_schema_v1.sql` only, and only when
   `SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user` is false: replace the exact text
   `ALTER ROLE app_router BYPASSRLS;` with `NULL;` before executing. Throw if that text does not occur exactly
   once. With `app_router` already created by step 1, 0001 takes its `ELSE` branch, which is that statement.
   The file on disk is untouched; `migrationBody` already rewrites the wrapper the same way.
3. `secureAppApiRole`: when `app_api` has none of `rolsuper`, `rolbypassrls`, `rolreplication`, run
   `ALTER ROLE app_api INHERIT NOCREATEDB NOCREATEROLE`; otherwise run today's full statement (which needs a
   superuser, correctly: such a database was misconfigured by one).
4. Nothing else. `MIGRATION_ADOPT_THROUGH` and the artifact probes are unchanged; 0009 is never adopted, it runs.

**Three database states, one path.**

- Local and CI (superuser): step 1 is a no-op apart from the lent CREATE, step 2 does not trigger, 0001 sets
  BYPASSRLS and 0009 removes it.
- A database with 0001–0007 already applied: only 0009 (and 0008 when merged) runs.
- RDS, empty: step 1 creates the roles, step 2 skips one statement, 0001–0009 run.

Between 0001 and 0009 on RDS `auth_lookup` returns nothing (no bypass, no policy yet). Every file runs before the
server starts, so nothing observes that state.

**Operator scripts read as the owner.** On RDS the owner sees a FORCE table only through a policy. Scripts loop
over `tenant` (no row security) and set `app.tenant_id` for each, which the existing `tenant_isolation` policy
honours for every role (measured). For one transaction that must act as the app and then call a definer function
(`import:undo`): `SET LOCAL ROLE app_user`, do the tenant-scoped work, `RESET ROLE`, call the function (measured).

**What Nimish runs on staging, in order.** Staging has never completed a migration, so its database is empty.

1. Backup first:
   `aws rds create-db-snapshot --db-instance-identifier uptimo-postgres --db-snapshot-identifier uptimo-pre-0009-<date>`,
   then `aws rds wait db-snapshot-available --db-snapshot-identifier uptimo-pre-0009-<date>`. Send the identifier
   to the orchestrator; it goes into the deploy note.
2. `gh workflow run deploy.yml`, then `gh run watch`. The deploy runs the migrations before it starts the server.
3. Open `site_url/api/v1/health` and expect `{"status":"ok"}`.

If step 2 stops at "migration failed", nothing was changed (one transaction per file) and the previous release keeps
running; send the log line to the orchestrator. On a database that holds data (none exists today) two steps go
between 1 and 2: `tsx scripts/preflight-cutover.ts` until it exits 0, then `tsx scripts/export-tags.ts`.

## 9. Migration plan

**What changes for stored data:** `ticket_tag` rows are removed (exported first); `platform_access.expires_at` is
shortened or filled on rows that break the 7-day rule (traced in `audit_log`); nothing else is rewritten.

**Backup step, first:** a full snapshot, its identifier recorded; then the preflight; then the tag export. The
migration header carries the same text.

**Roll back.**

- Before any support-access grant is approved under the new rules: run the down file. It restores the grants, the
  20 keys with their old actions, the expiries from the trace rows, drops the indexes, functions, columns and
  policies, and re-creates `ticket_tag` empty; the header gives the `\copy` line that reloads the export. Measured:
  `pg_dump` before 0009 and after 0009 + down + reload differ only by the three kept policies, the trace audit row
  and `updated_at` on the restored grant.
- After that: the down file refuses (it would drop approvals and audit links). Restore the snapshot.
- Not rolled back by design: `app_router` without BYPASSRLS and its policies on `login`, `session`, `sla_policy`.
  Putting BYPASSRLS back is impossible on RDS, and without the policies `auth_lookup` would return nothing.
- Code: the release before this one still deletes through `app_user` in import undo, so a code rollback without
  the down file breaks `import:undo` only. It is an operator command, not a user path.

## 10. What the slice plan must name (not done here)

| Item                                                          | Change                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/migrate.ts`                                          | §8 steps 1–3                                                                                                                                                                        |
| `scripts/export-tags.ts` (new)                                | Per-tenant loop; writes `ticket_tag-<utc>.csv` (all columns, header) to `--out <dir>`; prints N and the `PGOPTIONS` line; exits 0 with "nothing to export" on 0 rows or no table    |
| `scripts/preflight-cutover.ts` (new)                          | Per-tenant loop; the duplicate query of part 1; also prints the tag count and the grants whose expiry will change; exit 1 on any duplicate; exit 0 when the schema is not installed |
| `scripts/erase-person.ts`, `scripts/offboard-tenant.ts` (new) | Operator credential; call the function; erase deletes the returned `s3_keys`; offboard exports first, then deletes the storage prefix                                               |
| `imports/undo.ts`, `tickets/repo/imported.ts`                 | `deleteCandidates` + `finishUndo` become one `import_undo` call; `deleteImportedTickets` goes                                                                                       |
| `imports/cli.ts`, `imports/security.ts`                       | `import:undo` runs on the operator credential with the `SET LOCAL ROLE app_user` pattern; `assertAppApiRole` no longer fits undo                                                    |
| `modules/manifest.ts`, `tools/boundaries.test.ts`             | `ticket_tag` out (28 tables); the four functions get owners                                                                                                                         |
| `packages/db/test/seed.sql`                                   | Drop the `ticket_tag` insert; `platform_access` rows need `approved_by_login_id`                                                                                                    |
| `packages/db/test/isolation.test.ts`                          | `:113-117` expects `app_router` BYPASSRLS true, now false; `:207-255` is replaced by the two refusals item 21 words; `DATED_TABLES` loses `ticket_tag`                              |
| `packages/db/test/migration-runner.test.ts`                   | A non-superuser case for §8; the tags flag; the duplicate guard; up, down, up                                                                                                       |
| `apps/server/test/import-undo.test.ts`                        | Its tamper cases update `ticket_event` as admin and still can; the undo path changes under them                                                                                     |
| `packages/db/README.md`                                       | Roles table updated in this draft                                                                                                                                                   |

Regression risks to name: `auth_lookup` and `tenants_with_sla_policies` now depend on a policy (covered by the
sign-in tests and `sla.consistency`); the unique index turns a race in `raise` from a duplicate into a unique
violation that the route must map to today's "already open" reply; `DELETE /api/v1/lists/:list/:id` already
switches off (ticket 06).

## 11. Verified here, and how

Two throwaway `postgres:16-alpine` containers (Docker), `psql` only. No app test suite was run; none exists for
this file yet.

- Superuser path: 0001–0007, seed, 0009. Tag guard without the flag, with a wrong flag, with the count. Duplicate
  guard with a second open breakdown, then after cancelling it. Expiry backfill and trace on a NULL and a 30-day grant.
- As `app_api`: all ten revoked statements and the four functions refused; `auth_lookup`, list switch-off, event
  insert, session, push and idempotency deletes still work; the unique index refuses a second breakdown and allows
  a general request; the approver and 7-day checks; the audit link refuses another tenant's grant.
- As owner: deleting a login, person or ticket with history is refused; `DELETE FROM tenant` still cascades.
- `erase_person` with fake names in every §5 place, a Gujarati name, a name with punctuation, a two-letter short
  name, a namesake ("Ashok") and a second run: no row of the tenant held the name afterwards; the other tenant was
  untouched; event, crew and stretch counts unchanged.
- `import_undo`: five refusals, then success; counts, batch status, audit row and the untouched original ticket.
- `offboard_tenant`: blank and NULL references, an active tenant, then success; `audit_purge`: recent and NULL
  cut-offs refused, a 3-year-old row removed.
- Non-superuser path (§8): everything above that is role-sensitive, as a real `app_api` login and as the owner.
- `EXPLAIN ANALYZE` for §5. `pnpm migrations:check` and `pnpm migrations:immutable` pass.

## 12. Open questions for the orchestrator

1. **`audit_purge` and the job worker.** "Callable only by the router role" means the server cannot run it. Nothing
   is due before November 2029. Confirm the job slice decides (D23 consequence), or say now that this one function
   may be granted to `app_user`; its 3-year floor makes that safe.
2. **`import:undo` credential.** It must move from `DATABASE_URL` to the operator credential. Confirm, since
   `assertAppApiRole` was a deliberate guard.
3. **PR #158 (`ai_suggestion`).** Its keys to `person` and `login` are `SET NULL` and to `ticket` `CASCADE`, the
   pattern this ticket removes, and `erase_person` does not know its `output` column. Whichever merges second needs
   a follow-up: RESTRICT on the two actor keys, and the table added to `erase_person`.
4. **`ticket.machine_id` SET NULL.** Outside item 21, left alone. A deleted machine would blank the machine on its
   tickets (the snapshot stays). No route deletes a machine. Add `DELETE` on `machine` to the revokes and RESTRICT
   here, or leave it for M4?
5. **The lead-person filter** cannot use an index as written (§5). A code ticket to rewrite it as a UNION, with
   its two indexes.
6. **Audit detail for erasure.** Counts per table, as the ticket says, replaces §5's "which records and which
   fields". DATA-MAP is Nimish's document; the rewording needs his nod with the rest of the delta.
7. **`platform_access` itself** can still be updated and deleted by `app_user` (a grant with audit lines is held by
   RESTRICT). It reads like a record that should be insert-only. Not in item 31; say if it should join the revokes.
8. **"Signature removed".** Nothing writes a signature today. After erasure the report has no signature file and
   `handover_name = 'Former staff'`; the slice that builds signatures decides how the screen words it.
9. **Offboarding record** (DATA-MAP question 25, for Nimish).
