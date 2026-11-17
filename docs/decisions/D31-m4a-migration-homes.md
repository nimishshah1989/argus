# D31 — The M4a migration: one new table, and where every other stored item of the analytics face lives

Date: 14 November 2026. Ruled by the backend orchestrator (ticket 36 part B brief). Candidate list: the 36A figure catalogue (PR #267), §2.
Migration: `packages/db/migrations/0014_m4a_schema.sql` (revert in `down/`).

**Decision.** Migration 0014 adds the one M4a table D17 reserved (`kpi_snapshot`) and no other. Every other stored item
of the analytics face lives in a table that already exists:

| Item                                                  | Home                                                                                                             | Why it fits                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The engine's figures                                  | `kpi_snapshot` (new)                                                                                             | Derived, rewritten by a re-run, keyed by measure, subject, period and as-of day. Nothing existing holds a series of figures. The engine-run table and the scorecard table D17 removed are its `run_id`, `as_of` and `profile` columns.                                                                                                           |
| Legacy codes (ELE, HYD, ROT; M4b's old failure codes) | `list_item.aliases`, a list of lower-case strings on the entry they were folded into                             | Several old codes fold into one entry (D17: "aliases as a column on the row"). A trigger keeps them unique inside a list and apart from every other entry's code, under a per-list lock.                                                                                                                                                         |
| A saved Why-Why                                       | `ticket_event` type `why_why` on the closed ticket (five whys, conclusion; who and when are already on the line) | Per-breakdown, authored, timed, and history is append-only: a save adds a line, an edit adds another, and the platform's fault (editing a breakdown wiped its Why-Why) cannot recur. Its free text sits where `erase_person` already reaches (`text`, `payload`). The engine ticket (41) copies the conclusion to `breakdown_report.root_cause`. |
| Team Focus status, owner, note; a nudge's acknowledge | `setting` rows, one per item: `focus:<period>\|<action>` and `nudge:<rule>\|<subject>`                           | Small keyed state with no history of its own. One row per item means two heads never overwrite each other's item. The platform kept the same state as one browser-side object (`acAcks`).                                                                                                                                                        |
| A nudge's snooze                                      | The same `nudge:` row (`until` date; the length stays the existing `snoozeDays` threshold)                       | A snooze is a state of the nudge, not a thing of its own.                                                                                                                                                                                                                                                                                        |
| Spare cost of a breakdown                             | `breakdown_report.spare_cost`, `numeric(12,2)`, NULL = not recorded                                              | One column: Money Matters and the "spares spend" nudge read the sum (the platform kept up to three spares with a cost each; on the real data every cost is 0). Showing it only to heads and admin is the server's job (DATA-MAP §4), as for every money figure.                                                                                  |
| Where a machine moved from and to                     | `machine_move.from_location`, `to_location`                                                                      | The platform's cell change log carries the location with the cell (15 real moves); the move row had cells only.                                                                                                                                                                                                                                  |
| Footprint, conveyor side, efficiency factor           | `machine.metadata` (exists)                                                                                      | No migration.                                                                                                                                                                                                                                                                                                                                    |
| PDF import by QR                                      | **Dropped** (`docs/spec/DIFFERENCES.md` D21)                                                                     | Triage verdict `pdf-import`: tickets create the report now and the 1,350 history rows are already in the workbook. `breakdown_report.qr_payload` stays for printing.                                                                                                                                                                             |

**Free text must stay reachable by erasure.** A Team Focus or nudge note can name a person, and `erase_person` (D24, D30)
does not look in `setting`. A `BEFORE UPDATE OF erasure_hash` trigger on `person`, `SECURITY DEFINER` and owned by the router
role like `erase_person`, replaces the person's name, short name, number and own usernames in `setting` rows whose key starts
`focus:` or `nudge:`, with the same whole-word rule. For that the router role gets `SELECT` and `UPDATE (value, updated_at)`
on `setting` and one `router_definer` policy there, nothing more. Every other `setting` row is left alone.

**What `kpi_snapshot` may hold.** `value` holds ids and figures only, never a name (ticket 37 tests it). `subject_kind` has no
`person` value yet: Nimish ruled that technicians are ranked (DATA-MAP question 4) but the method is not agreed, and a
per-person figure is personal data. When it is, widening the check is one more migration. Retention: nothing is purged
now. The rule for ticket 37's engine job is to keep each month's last `as_of` rows forever and the daily rows of the last 90 days.

**Limits of the erasure trigger** (for whoever builds tickets 43 and 44):

- It matches whole words, ignoring case, like `erase_person`, so it over-scrubs a short name across the plant's notes, and it misses a
  first name when the person has no short name and a phone number written without the +91 prefix.
- It only fires for an operator in the router role (`session_user` is a member of `app_router`), so a stray write of
  `person.erasure_hash` from the app's own login scrubs nothing. The router role reads three columns of `setting`
  (`tenant_id`, `key`, `value`) and writes one (`value`, with `updated_at`).
- `erase_person`'s audit line does not count the `setting` rows the trigger changed. Follow-up for ticket 43.

**Limits of the alias trigger.**

- A bulk statement that swaps aliases between two entries of one list can fail halfway, because each row is checked as it is
  written; swap them in two statements. Concurrent bulk updates across lists can take the per-list locks in opposite
  order and deadlock; one of the two is rolled back and can be retried.

**The revert.**

- It restores a saved `sla_policy_id` only where that policy still exists, and `audit_purge` removes the `migration.0014` line
  after three years, so after that a revert restores nothing.
- It runs as the database owner with row security forced, lifting FORCE on `person`, `ticket`, `audit_log` and `sla_policy`
  for its own transaction, and `migration-runner.test.ts` runs it that way.

**Dropped columns.** `person.kind` (the team is `person.team`), `ticket.sla_policy_id` (the policy is found by severity) and
`ticket.handback_status` (the answer is the `handback_confirm` and `handback_dispute` history lines) are dropped because
no code on `main` reads or writes them (`tools/retired-columns.test.ts`; test fixtures and seeds that set them were
changed in the same PR). Before dropping, the migration writes every non-default value they hold into one `audit_log`
line per customer (`migration.0014`), and the revert puts those values back. Backup first, as for every migration that
removes data.

**Not done here, and why.** OEM tags (triage verdict DEFERRED; Cosmos has none; `machine.metadata` can take one). The M4b
tables (`forecast`, `intervention`, `pm_plan`, `asset_register`) wait for ticket 46. No index on `list_item.aliases`: a list
holds tens of entries.

**Rejected.**

- _A table for Team Focus and nudge state:_ the table budget is spent (D17 reserves the 12), and the data is a few dozen
  small rows.
- _One `setting` row holding a map of every nudge:_ two heads saving at once would overwrite each other, and one note
  would force the whole map through the erasure rewrite.
- _A follow-up task ticket per Team Focus action:_ it would put machine-level planning items into the desk's open list and
  the escalation clocks, which is a change for every technician.
- _A single `alias` text column:_ M4b maps Bhavin's 19 codes onto a coarser list of ours, which is many-to-one.
- _Teaching `erase_person` about `setting` by replacing the function again:_ 140 lines duplicated in the migration and its
  revert, for one extra statement. The trigger is 25 lines and reverts with one `DROP`.
- _An `as_of >= period_end` check on `kpi_snapshot`:_ the planning forecast looks ahead of the day it is computed.
