# 14 — Staging holds Cosmos, safe to run

Branch `claude/t14-staging-safe` · Blocked by 09, 13 (merged) · PR body says `Refs #N`, not `Closes`: half the proof
happens on AWS after Nimish applies things. This builder cannot touch AWS and did not.

## 1. What this delivers (code and written parts)

1. **Retention jobs** (goal 3). Each deletes only what is past its period, one customer at a time, and a second run
   deletes nothing. All take the clock as an argument (`now`), so tests use a fake clock.
2. **`figures.drift`** (goal 3). Nightly report, per customer, of closed tickets whose cached figures differ from a
   recompute of their events. Skips overridden figures and tickets raised by `import` or `backfill` (09 stores Bhavin's
   figures, which legitimately differ). Reports only; changes nothing.
3. **Backups as files** (goal 2). Terraform: longer point-in-time window, a separate backup bucket, a weekly dump
   (script on the instance, started by a scheduled workflow). Restore-drill runbook with exact commands in
   `infra/RESTORE.md`; empty log in `docs/plan/restore-drill-log.md`.
4. **Load Cosmos safely** (goal 1). Seed refuses to replace a Cosmos that already holds tickets (the known
   follow-up: seeding used to wipe the tenant). One command sequence in `infra/STAGING.md`, plus a first-deploy
   checklist for a non-technical person. `refresh-env.sh` puts `ROUTER_DATABASE_URL` in `migrate.env` only (tested).

## 2. Decisions (each with what it costs if wrong)

- **`audit.purge` is an operator command, not a worker job.** D24: the server must never hold the router credential,
  and `audit_purge` is router-only. So `pnpm audit:purge` (reads `ROUTER_DATABASE_URL`) calls the function. No audit row
  can be 3 years old before Nov 2029, so nothing runs it yet. Cost if wrong: one script to schedule later.
- **Orchestrator ruling kept:** `audit_purge` in migration 0009 would also delete the proof rows `person.erase` and
  `tenant.offboard`. Migration `0010` replaces the function so it skips those two actions; ordinary rows only.
  0010 changes a function and adds a function; it alters and deletes no data, so no extra backup step beyond the
  first-deploy snapshot that 0009 already needs. Revert file included.
- **One new function `job_tenant_ids()`** (executable by the app role) lists customers that still hold data (not offboarded) so a nightly job can
  fan out per customer; the app role cannot read `tenant`. Same pattern as `tenants_with_sla_policies()`. No table.
- **Retention rules (all counted from the row's own date, never from "now minus X" alone):**

  | Job                 | Deletes / clears                                                                                                           | Never touches                                                                                                      |
  | ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | `session.purge`     | sessions dead (expired, or revoked) for over 30 days; dead since = earliest of expiry and revocation                       | a live session; one revoked or expired less than 30 days ago                                                       |
  | `idempotency.purge` | command keys created over 30 days ago                                                                                      | newer keys (replay protection inside the window)                                                                   |
  | `import.purge`      | source content (`raw`, `canonicalJson`) of a row's payload, 1 year after its batch finished (`done`, `failed` or `undone`) | the row, its ticket link, format, both hashes and entry type (replay and undo read them); batches not yet finished |
  | `audit.purge` (CLI) | ordinary audit rows older than 3 years                                                                                     | `person.erase` and `tenant.offboard` rows (pending decision)                                                       |
  | `figures.drift`     | nothing: reports                                                                                                           | open tickets (their figures move with the clock)                                                                   |

- **`figures.drift` compares closed tickets only**, recomputed at the ticket's own close time. An open ticket's cached
  figures were right as of its last change, so comparing it with "now" would flag every working ticket.
- **Seed guard:** if Cosmos already holds any ticket, seeding stops with a plain message and changes nothing. An empty
  Cosmos is still replaced, as before (dev and CI rely on that).
- **No alias file** for the 31 pending people; the runbook says how an admin merges them.

## 3. Tests (behaviour, fake clock, each fails before the change)

Per purge: deletes past the period · keeps rows inside it (including the day before the edge) · second run deletes
nothing · another customer's rows untouched · history (tickets, events, segments, reports) untouched.
`session.purge`: live session survives. `import.purge`: payload cleared, row and ticket link stay, done, failed and undone
batches are cleared after a year (not before, not while running), replay of the same file still skipped and undo still works. `audit.purge`: erase and offboard proof rows survive,
a fresh purge note is written once. `figures.drift`: reports a planted difference, skips an override, skips `import`
and `backfill`, skips open tickets, is silent on a ticket made through the real commands. Seed: refuses over tickets,
leaves them intact. `refresh-env.sh`: router URL in `migrate.env`, absent from `app.env`.

## 4. Out of scope

Running anything on AWS. Terraform `apply`. Alias file for pending people. Scheduling `audit.purge` (nothing is old
enough until 2029). `notification.purge` (ticket 54, M2).

## 5. As built (what building it found)

- **`import_row.payload` is not disposable.** It holds the identity hash that replay protection compares and the entry
  type that undo reads. Clearing it to `{}` would have made a re-import throw and an undo impossible. `import.purge` strips
  only the source content and marks the row `purged`; a test re-imports and undoes after the purge.
- **The seed failed for a non-superuser owner** (RDS's master login is one): row security rejected its inserts. Reproduced on
  a plain Postgres 16 with a non-superuser owner, fixed by naming the tenant in the seed transaction, test added.
- **`pg_dump` fails for that same login** ("query would be affected by row-level security policy"). The weekly dump script
  stops instead of storing a partial file. Whether RDS's master login is exempt is **unverified**; RESTORE.md says what to do.
- **`audit.purge` rule:** a cut-off of 3 years and one day before the clock; the database function still refuses anything
  younger than 3 years by its own clock, so a wrong clock cannot purge young rows.
- **Run end to end on a copy of the real files** (plain Postgres 16, non-superuser owner): seed, then import (275 tickets,
  `unexplained: 0`), then every job (nothing to remove, `figures.drift` silent on imported tickets), then a second seed refused.
- **Not validated:** Terraform (`terraform` was not available and could not be downloaded here), and everything that
  needs AWS. The shell scripts and the workflow are tested against stubs only.
- **Merging pending people does not exist** and is not built here (ticket 21's people screen; touching history needs a design).
