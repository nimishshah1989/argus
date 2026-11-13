# Ticket 07 — History cannot be lost: schema design notes

GitHub #85 · Architect draft for the `schema-reviewer`, revised after its first review (§13) · ARCHITECTURE §9 items 21, 24, 25, 27, 31, 33 · D23.
Draft files: `packages/db/migrations/0009_history_cannot_be_lost.sql` and
`packages/db/migrations/down/0009_history_cannot_be_lost.down.sql`. No app code, test or script is written here;
§9 and §10 say what the slice plan must name.

**Number.** `0009`, because open PR #158 holds `0008_ai_suggestion.sql`. The runner applies by name and skips
what its ledger holds, so either merge order works. Neither file depends on the other (see open question 5).

**No new table.** `ticket_tag` goes: 29 tables become 28, as D17 counts. Nothing here needed a table, including the offboarding record (§7).

## 1. What the migration does, in order

| Part | Change                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| top  | `SET LOCAL row_security = off`; FORCE lifted on the 13 tables the file reads, rewrites or re-validates (D23 pt 5)            |
| 1    | Two guards that stop everything: unexported tags; more than one open breakdown on a machine                                  |
| 2    | `app_router` loses BYPASSRLS where it has it                                                                                 |
| 3    | `DROP TABLE ticket_tag`                                                                                                      |
| 4    | 21 foreign keys become `ON DELETE RESTRICT`                                                                                  |
| 5    | Support access: every existing grant ended with a trace; expiry required and capped at 7 days; approver; trigger; audit link |
| 6    | Four indexes and the partial unique index                                                                                    |
| 7    | `tenant.status` may be `offboarded`                                                                                          |
| 8    | Revokes on `app_user`; grants and `router_definer` policies for `app_router`                                                 |
| 9    | The four definer functions and the JSON helper                                                                               |
| 10   | FORCE put back on the 12 remaining tables                                                                                    |

One transaction. A failed guard or statement leaves the database exactly as it was, so the grant changes are never
half-applied (item 25).

## 2. Grants (item 21)

Revoked from `app_user`, and so from `app_api`, which has no grants of its own:

- `UPDATE, DELETE` on `ticket_event`
- `DELETE` on `ticket`, `work_segment`, `crew_member`, `breakdown_report`, `breakdown_report_person`, `list_item`,
  `login`, `person`, and (review findings 2 and 9) `machine`, `machine_move`, `file`

**Nothing the app does today is broken by the three added revokes.** `grep -rni "DELETE FROM" apps/server/src`
finds only `identity/repo.ts:143` (tenant, seed, run as owner), `notifications/repo.ts:57` (`push_subscription`),
and `tickets/repo/imported.ts:216` and `:220` (import undo, which moves to `import_undo`). The only DELETE route,
`plant/routes.ts:148`, switches a list entry off. No route removes a photo, a file, a machine or a machine move.

Still deletable by the app, on purpose: `session` (sign-out, `session.purge`), `push_subscription` (unsubscribe),
`command_idempotency` (`idempotency.purge`), and the other configuration tables. `tenant` was never granted.

## 3. Foreign keys

**Changed to RESTRICT (21).** Each is dropped and re-added with the same name, columns and target; names read from
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
| `ticket`                  | `ticket_machine_id_fkey`                       | SET NULL |
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

Three go beyond the ticket's list, both by the same rule: `login_person_id_fkey` (a login that silently loses its
person changes who "acted" on every event it wrote) and the two `file` keys (a photo or PDF that loses its ticket is
lost evidence), and, after review, `ticket_machine_id_fkey` (a deleted machine blanked the machine on its tickets). Neither can fire from the app once the deletes are revoked; they close the owner's path too.

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
| `machine_move`, `machine`, `machine_group` → their parents        | as built            | Configuration                                                                                                                         |
| `ai_suggestion` keys (PR #158, not on main)                       | as PR #158 has them | The table may not exist when 0009 runs. Open question 5                                                                               |

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
together. Open question 6.

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
| trigger `platform_access_guard`, BEFORE INSERT OR UPDATE            | See below                                                                                            |
| `audit_log.platform_access_id` + composite key to `platform_access` | RESTRICT; needs the new `platform_access_tenant_id_unique (tenant_id, id)`                           |

**The trigger.** The 7-day check is only as good as `created_at`, which the app could write. So:

- on insert, `created_at` is set to the database's `now()`, whatever the caller sent;
- on update, a changed `created_at` is refused, and so is a later `expires_at` than the row had (shortening is allowed);
- on insert, and on any update that changes the approver, `approved_by_login_id` must be a login of the same tenant
  with role `admin` and not disabled. "Not disabled" is one step beyond the finding; a switched-off admin approving
  access would defeat the rule.

It runs as the caller, so under row security the app can only ever name a login of its own tenant.

**Existing rows.** No row is deleted.

- No existing grant has an approver, so none may stay live. Each gets
  `expires_at = least(expires_at, created_at + 7 days, now())`: an empty or over-long expiry is capped, and a live
  grant ends at the cutover. A grant that had already ended is not touched.
- Each changed row first gets an audit line, action `migration.0009.platform_access_expiry`, with the old and new
  value (DATA-MAP §6 rule 3). The down file restores from the latest such line per grant.
- Approver: left empty. There is no truthful value to fill in. `NOT VALID` means PostgreSQL enforces the rule on
  every insert and every later update, and does not judge the rows that predate it.

Rejected: backfilling the approver with the tenant's first admin (a false record); deleting grants without an expiry
(loses rows); a nullable approver enforced only in code; trusting the app to send `created_at`.

The table is "built, not used yet"; the seed is the only writer.

## 7. The definer functions

Exact signatures after the review:

```sql
import_undo(p_batch_id uuid, p_operator text) RETURNS integer
erase_person(p_person_id uuid, p_request_ref text, p_operator text) RETURNS jsonb
offboard_tenant(p_tenant_id uuid, p_export_ref text, p_backup_ref text, p_operator text) RETURNS void
audit_purge(p_older_than timestamptz, p_operator text) RETURNS bigint
erase_json_values(j jsonb, pat text) RETURNS jsonb   -- helper of erase_person; IMMUTABLE, not a definer
platform_access_guard() RETURNS trigger              -- §6; runs as the caller
```

The first four: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`. The first five: owner
`app_router`, `REVOKE ALL … FROM PUBLIC`, no other grant. Measured: `app_api` gets `permission denied for function`
on each of the five. Each of the four refuses a NULL or blank `p_operator` and writes it into its audit row.
Model and rejected alternatives: D23.

Manifest owners for the slice plan: `import_undo` → imports; `erase_person`, `erase_json_values`,
`offboard_tenant`, `platform_access_guard` → identity; `audit_purge` → ops.

### `import_undo`

Replaces `deleteImportedTickets` and `markUndone` plus the audit write in `imports/undo.ts`. The tickets come from
the batch's own `import_row` rows, never from the caller.

Refuses unless all of these hold:

- the batch exists with `source = 'bhavin'`, status `done` or `failed`, and a `finished_at`;
- `stats.completion.tickets` is an array, and the imported rows and that fingerprint name the same tickets;
- every ticket has `raised_channel` in (`import`, `backfill`);
- **no `ticket_event`, `crew_member` or `work_segment` row of those tickets has `created_at > finished_at`, and no
  `ticket_event` of them has a `login_id`** (an import writes events with no login, `tickets/repo/imported.ts:83`).
  Work done on an imported ticket afterwards is real history and is not undone;
- no ticket outside the set has a parent inside it;
- no `file` points at a ticket of the set and no report of the set has a signature or PDF.

The content comparison (`assertCompletion`) stays in `undo.ts`, before the call, in the same transaction (§8).

| Table                     | Rows touched                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `import_batch`            | The one batch: locked, then `status = 'undone'`                                                            |
| `breakdown_report_person` | Deleted: rows of reports on the batch's tickets                                                            |
| `breakdown_report`        | Deleted: reports on the batch's tickets                                                                    |
| `work_segment`            | Deleted: the batch's tickets                                                                               |
| `crew_member`             | Deleted: the batch's tickets                                                                               |
| `ticket_event`            | Deleted: the batch's tickets                                                                               |
| `ticket`                  | Deleted: the batch's tickets; the count must equal the set or everything rolls back                        |
| `sla_timer`               | Deleted by the existing cascade from `ticket`                                                              |
| `import_row`              | `ticket_id` emptied by the existing SET NULL; the rows stay                                                |
| `audit_log`               | One row, `import.undo`: before = status, fingerprint digest, ticket ids; after = `undone`, count, operator |

### `erase_person`

Deletes no history row. Search terms are the person's name, short name, mobile number and the usernames of their
own (not shared) logins, matched case-insensitively as whole words, any run of spaces matching any run of spaces.
Returns the counts plus `s3_keys`, the storage objects the calling script must delete.

Refuses when the reference or the operator is empty, or when either contains one of the terms (so a name cannot
reach the audit row). That second test runs only when there is at least one searchable term; with none there is
nothing to test against.

DATA-MAP §5, place by place:

| §5 place                      | Table: what happens                                                                                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The person                    | `person`: `name = 'Former staff'`; `short_name`, `phone`, `title`, `default_shift` emptied; `active = false`                                                                                                                                                                                              |
| Their logins                  | `login` where `person_id` is the person: `username = 'former-<login id>'`, `password_hash = '!'` (not a hash, so nothing verifies), `disabled_at` set if empty                                                                                                                                            |
| Devices, push registrations   | `session`, `push_subscription`: **deleted only where `login_id` is one of the leaver's logins.** On any other row (a shared floor login they were acting on) `acting_person_id` is emptied and the row stays, so the floor phone stays signed in. WhatsApp contact is `person.phone` (D17), emptied above |
| Breakdown report typed fields | `breakdown_report`: terms replaced in `problem`, `observed_by`, `corrective_action`, `spare_used`, `root_cause`, `handover_name`                                                                                                                                                                          |
| Ticket text                   | `ticket`: terms replaced in `problem`, `location`, `close_note`, `waiting_spare`, `task_reason`, and in the text values of `overrides`                                                                                                                                                                    |
| Ticket history                | `ticket_event`: terms replaced in `text` and in the text values of `payload`. The one permitted edit of history                                                                                                                                                                                           |
| Import rows                   | `import_row`: `payload = '{}'` on every row of the tenant with a term in a text value of its payload                                                                                                                                                                                                      |
| Import batch                  | `import_batch.stats`: terms replaced in every text value outside `completion` (`pendingPersons`, `fatal.message`, `issues[].message`); `stats.completion` is put back untouched, so the undo fingerprint holds                                                                                            |
| Audit before and after        | `audit_log`: on rows about this person or their logins every stored value is blanked and the field names kept; on every other row of the tenant the terms are replaced in text values                                                                                                                     |
| Signature images              | `breakdown_report.signature_file_id` emptied where `handover_name` held a term; the `file` row deleted; key returned                                                                                                                                                                                      |
| Repeat guard                  | `command_idempotency`: `result = '{}'` where the login is theirs or a text value of the stored reply holds a term. The row stays, so the key still blocks a replay                                                                                                                                        |
| Saved report PDFs             | Every `breakdown_report.pdf_file_id` of the tenant emptied, `qr_payload = '{}'`, the `file` rows deleted, keys returned. A PDF bakes in names and is re-made on the next request                                                                                                                          |
| Audit of the erasure          | One `audit_log` row, `person.erase`: `after` = one count per table, the request reference and the operator. No name, no text, no ids of changed rows                                                                                                                                                      |

Decisions inside it:

- **Whole words: the neighbour on each side must be a space, ASCII punctuation, or the start or end of the text**
  (`(?<![^[:space:][:punct:]])…(?![^[:space:][:punct:]])`). A name inside a longer word survives in any script:
  "રમેશભાઈ" is untouched when "રમેશ" is erased, and "Ashok" when "Asha" is (both measured). The first draft used
  "not a letter or digit", which under a C locale would have cut a Gujarati name out of a longer Gujarati word.
- **JSON: text values only.** `erase_json_values` walks objects and arrays and replaces inside strings. A key that
  happens to equal the name keeps its name, numbers and shape are untouched (measured). The first draft replaced
  in the JSON text, which could rename a key.
- **Terms under three characters are not searched** and are counted in `skipped_short_terms`. "RP" or "Om" would
  rewrite ordinary text. They join the nicknames the plant reviews by hand (DATA-MAP §5).
- **A person with no searchable term at all** (a two-character name such as "Om" or "જય", no short name of three
  letters, no mobile number, no login of their own) is still erased by id: the person becomes "Former staff" and
  is switched off, their logins are neutralised, their own devices go, shared devices forget them, the repeat
  guard is cleared for their own logins, their own audit lines are blanked and the cached PDFs are dropped. No
  text is searched and no other row is touched (measured). The audit row carries `text_searched: false` and
  `skipped_short_terms`. The function does not refuse: the id-linked half is the larger part of the erasure and
  should not wait for the review.
- **`text_searched: false` means no automatic text pass ran, so the plant reviews every text place by hand:**
  ticket problem, location, close note, waiting-for-spare note, task reason and overrides; ticket history text and
  payload; the breakdown report fields, including `observed_by` and `handover_name`; import rows and
  `import_batch.stats`; audit lines about other people; other people's stored repeat-guard replies; and the
  signature image on any report handed over to that person (the function finds those reports by matching
  `handover_name`, so with no pattern it removes no signature). `scripts/erase-person.ts` must print this list
  when it sees `text_searched: false`, and must not report the request complete until the review is recorded.
- **`erase_json_values` returns its input unchanged when the pattern is NULL**, and the repeat-guard update uses
  the text match only when there is a pattern. In the first amended draft a NULL pattern blanked the stored reply
  of every repeat-guard row of the tenant (second review, finding 1).
- **All of the plant's cached PDFs go, not only the leaver's.** Which names a PDF shows depends on the template,
  which will change; "all" cannot go stale, and the cost is a re-render. Only `file` rows a report points at are
  deleted, so a future manual stored as a PDF is safe.
- **`updated_at` is bumped** on changed tickets and reports, so a device holding an offline copy fetches the cleaned
  text. Side effect: those tickets rise in lists ordered by last change.
- **Running it twice is harmless.** The second run finds nothing and writes a second audit row of zeros.
- **Later tables extend the function** with `CREATE OR REPLACE` in their own migration: `ai_suggestion` (PR #158),
  `notification`, `wa_message`.

### `offboard_tenant`

Refuses when a reference or the operator is empty or blank, when the tenant does not exist, and when its status is
not `suspended`. Then, in order:

1. `DELETE FROM tenant WHERE id = …`: the `ON DELETE CASCADE` keys from every tenant table remove all of that
   customer's rows, in every table that carries `tenant_id`, including tables added later.
2. The tenant row is put back with the same id, name, language, time zone, plan and creation time,
   `status = 'offboarded'` and `slug = 'offboarded-<id>'`, so the address is free for a new customer. No logo.
3. One `audit_log` row, `tenant.offboard`: `after` = export reference, backup reference, operator.
4. `RAISE LOG` with the same three values.

- **Why the tenant row stays** (orchestrator ruling on question 25: the proof is the audit row, no new table).
  `audit_log.tenant_id` must point at a tenant, so the proof needs one. Delete-then-reinsert keeps the single
  cascade, which no later table can be forgotten from. `tenant_status_check` gains `offboarded`. Sign-in cannot
  reach the row: `tenant_by_slug` answers only for `active`.
- **Suspend first** is an interlock against a mistyped id; it also makes a second call fail.
- The export and backup files live in the backup bucket; the references name them.
- The script that calls it also deletes the tenant's storage prefix and queued jobs; neither is in the database
  schema this ticket owns.

Rejected: deleting each table in a hand-written order so the tenant row is never deleted (every new table must be
added to the list, and a miss leaves a customer's rows behind); a nullable `audit_log.tenant_id` (weakens every
tenant policy on the table); the database log alone (not in the customer's record, and logs expire).

### `audit_purge`

Refuses a NULL cut-off, one newer than `now() - 3 years`, or a blank operator. Deletes `audit_log` rows with
`at < p_older_than`, across tenants, and writes one `audit.purge` row for each customer that lost rows:
`after` = cut-off, number deleted, operator. Returns the total. It stays executable by `app_router` only
(orchestrator ruling).

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

**Runner changes, `scripts/migrate.ts`** (for the slice plan; **still unwritten**):

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

**`ROUTER_DATABASE_URL`.** The one new environment value.

- What it is: a PostgreSQL URL for a login that is a member of both `app_router` and `app_user`. Today the only
  such login is the migration role, so its value is the same connection string as `MIGRATION_DATABASE_URL`.
- Who reads it: the `import:undo` code path only (`imports/cli.ts`). It opens one transaction on that connection,
  does `SET LOCAL ROLE app_user` plus `app.tenant_id` for the fingerprint checks (row security on, exactly the app's
  rights), then `RESET ROLE` and `SELECT import_undo($1, $2)`. If the value is missing, undo stops with a message.
- Who must not have it: the running server. `app.env` keeps `DATABASE_URL` only. The secret key
  `ROUTER_DATABASE_URL` belongs in `uptimo/staging` and in `migrate.env` (written by `infra/instance/refresh-env.sh`).
  `infra/` was not touched here; that edit is a follow-up for whoever owns ticket 13's files.
- The other operator scripts (erase, offboard, purge, export, preflight) run on `MIGRATION_DATABASE_URL` directly.

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

**What changes for stored data:** `ticket_tag` rows are removed (exported first); every existing support-access
grant is ended (`expires_at` no later than now, and never more than 7 days after the grant), each change traced in
`audit_log`; nothing else is rewritten.

**Backup step, first:** a full snapshot, its identifier recorded; then the preflight; then the tag export. The
migration header carries the same text.

**Roll back.**

- Before any support-access grant is approved under the new rules and before any customer is offboarded: run the
  down file. It restores the grants on `app_user`, the 21 keys with their old actions, the expiries from the latest
  trace row of each grant, and the two-value tenant status check; it drops the indexes, functions, trigger, columns
  and policies, and re-creates `ticket_tag` empty. The header gives the `\copy` line that reloads the export.
  Measured: `pg_dump` before 0009 and after 0009 + down + reload differ only by the three kept policies, the trace
  audit rows and `updated_at` on the restored grants.
- After either of those: the down file refuses (it would drop approvals, audit links or an offboarding record).
  Restore the snapshot.
- **Restoring from a backup.** An RDS snapshot restore is physical: no trigger or check runs. A full `pg_restore`
  (or `psql` of a full `pg_dump`) into an empty database is also unaffected, because the dump loads the rows
  before it creates triggers and `NOT VALID` checks (measured). Only a data-only reload of `platform_access` into
  a database that already has 0009 needs care: `platform_access_guard` would reset each `created_at`, and it and
  the approver check refuse the grants from before the rule (measured). Around such a reload:

  ```sql
  ALTER TABLE platform_access NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE platform_access DISABLE TRIGGER platform_access_guard;
  ALTER TABLE platform_access DROP CONSTRAINT platform_access_approver_required;
  -- reload
  ALTER TABLE platform_access ADD CONSTRAINT platform_access_approver_required
    CHECK (approved_by_login_id IS NOT NULL) NOT VALID;
  ALTER TABLE platform_access ENABLE TRIGGER platform_access_guard;
  ALTER TABLE platform_access FORCE ROW LEVEL SECURITY;
  ```

  FORCE is lifted because the owner on RDS is not a superuser and would otherwise be stopped by row security.
  `pg_restore --disable-triggers` can stand in for the DISABLE and ENABLE lines, but it needs a superuser: not
  for RDS. Data-only reload only from a dump taken after 0009. A pre-0009 backup is restored in full into an
  empty database and 0009 is then run again.

  The same text is in the header of both migration files.

- Not rolled back by design: `app_router` without BYPASSRLS and its policies on `login`, `session`, `sla_policy`.
  Putting BYPASSRLS back is impossible on RDS, and without the policies `auth_lookup` would return nothing.
- Code: the release before this one still deletes through `app_user` in import undo, so a code rollback without
  the down file breaks `import:undo` only. It is an operator command, not a user path.

## 10. What the slice plan must name (not done here)

| Item                                                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/migrate.ts`                                          | §8 steps 1–3. **Still unwritten.** Without them 0001 cannot run on RDS                                                                                                                                                                                                                                                                                                                                                     |
| `imports/batch.ts`, `imports/bhavin.ts`, `imports/repo.ts`    | **Required by finding 4.** `finished_at` is written today from a clock value taken when the import starts (`bhavin.ts:306`, passed at `:290` and `batch.ts:76`). It must be stamped by the database when the batch finishes (`finished_at = clock_timestamp()` in `finishBatch` and `failBatch`). Until then `import_undo` refuses every batch, because every imported row is newer than the stored finish time (measured) |
| `scripts/export-tags.ts` (new)                                | Per-tenant loop; writes `ticket_tag-<utc>.csv` (all columns, header) to `--out <dir>`; prints N and the `PGOPTIONS` line; exits 0 with "nothing to export" on 0 rows or no table                                                                                                                                                                                                                                           |
| `scripts/preflight-cutover.ts` (new)                          | Per-tenant loop; the duplicate query of part 1; also prints the tag count and the grants that will be ended; exit 1 on any duplicate; exit 0 when the schema is not installed                                                                                                                                                                                                                                              |
| `scripts/erase-person.ts`, `scripts/offboard-tenant.ts` (new) | Operator credential; pass `--operator`; erase deletes the returned `s3_keys`; offboard exports first, then deletes the storage prefix                                                                                                                                                                                                                                                                                      |
| `imports/undo.ts`, `tickets/repo/imported.ts`                 | `deleteCandidates` + `finishUndo` become one `import_undo` call; `deleteImportedTickets` goes                                                                                                                                                                                                                                                                                                                              |
| `imports/cli.ts`, `imports/security.ts`                       | `import:undo` connects with `ROUTER_DATABASE_URL` (§8) and uses the `SET LOCAL ROLE app_user` pattern; it takes `--operator`; `assertAppApiRole` no longer fits undo                                                                                                                                                                                                                                                       |
| `modules/manifest.ts`, `tools/boundaries.test.ts`             | `ticket_tag` out (28 tables); the functions get owners                                                                                                                                                                                                                                                                                                                                                                     |
| `packages/db/test/seed.sql`                                   | Drop the `ticket_tag` insert; add an admin login per tenant and name it as `approved_by_login_id` on the `platform_access` rows                                                                                                                                                                                                                                                                                            |
| `packages/db/test/isolation.test.ts`                          | `:113-117` expects `app_router` BYPASSRLS true, now false; `:207-255` is replaced by the two refusals item 21 words; `DATED_TABLES` loses `ticket_tag`                                                                                                                                                                                                                                                                     |
| `packages/db/test/migration-runner.test.ts`                   | A non-superuser case for §8; the tags flag; the duplicate guard; up, down, up                                                                                                                                                                                                                                                                                                                                              |
| `apps/server/test/import-undo.test.ts`                        | Its tamper cases update `ticket_event` as admin and still can; the undo path changes under them                                                                                                                                                                                                                                                                                                                            |
| `apps/server/src/seed/cosmos.ts`                              | `deleteTenantBySlug` as the owner still works (§3); no change needed                                                                                                                                                                                                                                                                                                                                                       |
| `packages/db/README.md`                                       | Roles table updated in this draft                                                                                                                                                                                                                                                                                                                                                                                          |

Regression risks to name: `auth_lookup` and `tenants_with_sla_policies` now depend on a policy (covered by the
sign-in tests and `sla.consistency`); the unique index turns a race in `raise` from a duplicate into a unique
violation that the route must map to today's "already open" reply; `DELETE /api/v1/lists/:list/:id` already
switches off (ticket 06); any code that lists tenants must skip `status = 'offboarded'` (today only
`tenant_by_slug` reads status, and it asks for `active`).

## 11. Verified here, and how

Two throwaway `postgres:16-alpine` containers (Docker), `psql` only. No app test suite was run; none exists for
this file yet. Re-run in full after the review changes.

- Superuser path: 0001–0007, seed, 0009, down, tag reload, 0009 again. Tag guard without the flag, with a wrong
  flag, with the count. Duplicate guard with a second open breakdown, then after cancelling it. Every seeded grant
  ended at the cutover with a trace row; a grant that had already ended left alone; the down restores each expiry.
- As `app_api` (also as a real `app_api` login on the non-superuser database): 13 revoked statements (now with
  `machine`, `machine_move`, `file`) and all five functions refused; `auth_lookup`, list switch-off, machine
  update, event insert, session, push and idempotency deletes still work; the unique index refuses a second
  breakdown and allows a general request.
- Support-access trigger: refused with no approver, a technician approver, another customer's admin, 8 days, and a
  back-dated grant time; an accepted grant gets the database's time whatever the caller sent; extending it, moving
  its grant time and swapping the approver for a non-admin are refused; shortening works; the audit link refuses
  another tenant's grant and then holds the grant against deletion.
- As owner: deleting a login, person, ticket or machine with history is refused; `DELETE FROM tenant` still cascades.
- `erase_person`: refused without a reference, without an operator, and with the name in either. With fake names
  in every §5 place: no column of the tenant held the name afterwards outside JSON keys and `stats.completion`;
  a JSON key named like the person kept its name and a JSON number was untouched; nested values were replaced;
  `location` cleaned; `import_batch.stats` cleaned with `completion` byte-identical; the leaver's own session and
  push registration deleted; a shared floor login's session and push registration kept with the actor cleared;
  event, crew and stretch counts unchanged; a namesake ("Ashok") and the other tenant untouched; a second run
  changes nothing. Gujarati: the name as a whole word and inside brackets was replaced, the name inside a longer
  Gujarati word survived, a two-letter short name was counted and skipped, a name with an apostrophe, brackets and
  a full stop was replaced inside quotes and left alone when a letter followed it.
- `import_undo`: refused without an operator, without a finish time, with a finish time earlier than its rows, with
  an event, a crew row or a stretch created after the finish time, with an event written by a login, with a
  non-import ticket, an outside child, and rows that disagree with the fingerprint; then success with counts, batch
  status, the audit row carrying the operator, and the untouched original ticket; a second call refused.
- `offboard_tenant`: blank reference, missing operator, an active tenant refused; then success: every tenant table
  empty for that customer, the tenant row `offboarded` with slug `offboarded-<id>`, one `tenant.offboard` audit row
  with both references and the operator, sign-in lookup returns nothing, the old slug can be used by a new
  customer, and a second call is refused.
- `audit_purge`: recent cut-off and missing operator refused; old rows of two tenants removed, one `audit.purge`
  row written for each with the cut-off, its count and the operator.
- `erase_person` for a person with no searchable term, once with the name "Om" and once with "જય" (no phone, no
  login), with those words planted in ticket text, an event, a stored reply, an import row, batch stats and an
  audit line: a row-by-row hash of `ticket`, `ticket_event`, `breakdown_report`, `command_idempotency`,
  `import_row`, `import_batch`, `audit_log`, `login` and the other people was identical before and after
  (so no `updated_at` moved either); the person became "Former staff"; a shared floor session they were acting on
  stayed with the actor cleared; one `person.erase` audit row each, with `text_searched: false` and
  `skipped_short_terms: 1`. `erase_json_values(x, NULL)` returns `x`. Run on both database kinds. No report in
  that data had a cached PDF; had one existed it would have been dropped, by design.
- Dump and reload of `platform_access` (`pg_dump -Fc`, rows from before the rule and an approved one): a full
  `pg_restore` into an empty database gives identical `created_at`, `expires_at` and approver with no flag; a
  data-only reload into a migrated database is refused as it stands; with the trigger disabled alone it is still
  refused, by the approver check; with the runbook of §9 (both the `ALTER … DISABLE TRIGGER` form and
  `--disable-triggers`) the rows come back identical, the trigger is enabled again, the check is `NOT VALID`
  again, and a new unapproved grant is refused.
- Non-superuser owner (§8): 0001 (one statement skipped) to 0007, 0009, down, 0009 again; the schema dump after
  the down differs from before only by the three kept policies; all 27 row-security tables forced again; the down
  refuses once a grant is approved or a customer is offboarded.
- `EXPLAIN ANALYZE` for §5 (first round; the indexes did not change). `pnpm migrations:check`,
  `pnpm migrations:immutable` and `pnpm docs:check` pass.

Not done: anything on real RDS; the runner changes as TypeScript; the operator scripts; `PGOPTIONS` through `pg`
end to end (read in `connection-parameters.js` only); pg-boss install as a non-superuser.

## 12. Open questions for the orchestrator

1. **Finding 4 needs an importer change (§10, second row).** As worded, the rule is correct and fails safe, but
   with today's importer it refuses every undo. The slice must change how `finished_at` is stamped, or the rule
   must compare against something else. I kept the reviewer's wording.
2. **`ROUTER_DATABASE_URL` holds the migration role's connection** (§8). A dedicated login that is only a member
   of `app_router` and `app_user` would be narrower; it needs a new role, a new secret and an `infra/` change, so
   it is left as a follow-up.
3. **The offboarded tenant row.** Keeping it (name, language, time zone, plan; slug freed) is what gives the
   audit row a home without a table. If the customer's name must go too, the function can blank it; say so.
4. **`audit.purge` rows** are written only for customers that lost rows, so a daily run with nothing to purge
   leaves no trace. Say if every run should leave one row per customer.
5. **PR #158 (`ai_suggestion`).** Unchanged from round one: its keys to `person` and `login` are `SET NULL` and
   to `ticket` `CASCADE`, and `erase_person` does not know its `output` column. Whichever merges second needs a
   follow-up. Not touched here.
6. **The lead-person filter** cannot use an index as written (§5). A code ticket to rewrite it as a UNION, with
   its two indexes.
7. **`platform_access` rows** can still be deleted by `app_user` when no audit line points at them. The trigger
   now stops every lengthening edit; deletion of an unused grant is the remaining gap. Not in item 31 or the
   findings; say if DELETE should be revoked too.
8. **"Signature removed".** Nothing writes a signature today. After erasure the report has no signature file and
   `handover_name = 'Former staff'`; the slice that builds signatures decides how the screen words it.
9. **A legacy grant cannot be edited by the app at all** (the approver check applies to every update). All of them
   are ended by the migration, so nothing needs editing; noted so it is not a surprise.

## 13. Review round 2: what changed per finding

| #   | Finding                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `import_batch.stats`         | `erase_person` walks `stats` without `completion` and replaces the name in every text value (covers `pendingPersons`, `fatal.message`, `issues[].message`); `completion` is put back untouched; count `import_batch`. DATA-MAP row and §5 row added                                                                                                                                                                                   |
| 2   | `ticket.machine_id`          | `ticket_machine_id_fkey` is RESTRICT (21 keys now); DELETE revoked on `machine` and `machine_move`; both restored in the down file                                                                                                                                                                                                                                                                                                    |
| 3   | `platform_access`            | Trigger `platform_access_guard` (§6); every existing grant ended at cutover with a trace row                                                                                                                                                                                                                                                                                                                                          |
| 4   | `import_undo` and later work | Refuses on any event, crew row or stretch created after `finished_at`, on an event with a login, and on a batch with no finish time. Needs the importer change in §10                                                                                                                                                                                                                                                                 |
| 5   | Word boundary                | Neighbour must be a space, ASCII punctuation, or the start or end of the text. A Gujarati name inside a longer Gujarati word survives (measured)                                                                                                                                                                                                                                                                                      |
| 6   | Operator                     | All four functions take a required, non-blank `p_operator`, written to the audit row's `after` (and the log line for offboarding). `audit_purge` writes one `audit.purge` row per customer that lost rows                                                                                                                                                                                                                             |
| 7   | Sessions and push            | Deleted only for the leaver's own logins; elsewhere `acting_person_id` is emptied and the row stays; counts `session_unlinked`, `push_subscription_unlinked`                                                                                                                                                                                                                                                                          |
| 8   | JSON values only             | New helper `erase_json_values` walks objects and arrays and replaces inside text values only. Used for `ticket.overrides`, `ticket_event.payload`, `audit_log.before/after`, `import_batch.stats` and the match tests on `import_row.payload` and `command_idempotency.result`. The quote-or-backslash refusal is gone: it is no longer needed. `ticket.location` added                                                               |
| 9   | `file`                       | DELETE revoked. Evidence that nothing breaks: `grep -rni "DELETE FROM" apps/server/src` finds only `identity/repo.ts:143` (tenant, seed), `notifications/repo.ts:57` (push_subscription), `tickets/repo/imported.ts:216` and `:220` (import undo). No route deletes a file, photo, machine or machine move; the only `app.delete` route is `plant/routes.ts:148`, which switches a list entry off. No floor or desk behaviour changes |
| 10  | `ticket_tag` in DATA-MAP     | Row marked removed; the export file is the only remaining copy, kept with the backup                                                                                                                                                                                                                                                                                                                                                  |
| —   | Ruling on question 25        | `offboard_tenant` keeps the tenant row as `offboarded` and writes one `tenant.offboard` audit row with the export reference, the backup reference and the operator. No new table                                                                                                                                                                                                                                                      |

**Second review (scoped re-check), two findings.**

1. `erase_person` with no searchable term. The request-reference test and the text arm of the repeat-guard update
   now run only when there is a pattern; the repeat guard is still cleared for the leaver's own logins;
   `erase_json_values` returns its input for a NULL pattern; the count is renamed `skipped_short_terms` and
   `text_searched` is added. Behaviour for such a person is stated in §7 and measured in §11.
2. `platform_access_guard` and reloads. The runbook is in both file headers and §9. One thing beyond the finding:
   disabling the trigger is not enough for a data-only reload, because the `NOT VALID` approver check also refuses
   the older grants; the runbook lifts and re-adds it. A full restore into an empty database needs neither.
