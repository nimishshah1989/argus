# 20 — Admin fixes (API goal 1 only)

Issue #95 (`Refs #95`; goal 2, the audit screen and CSV, is a screen ticket and stays open). Branch `claude/t20-admin-fixes-api`.
No table, no migration, no new dependency, no `apps/web` change.

## What was already there

Cancel, restore and correct existed as domain commands and routes (PR #16, #41, #43, #58): roles per DOMAIN §3, 7-day limits,
the machine and kind changes, severity following a corrected machine or kind. This PR proves them and closes the gaps the proof found.

## Gaps found, each with a failing test first (`apps/server/test/admin-fixes.test.ts`)

1. A correction's old and new values were dropped when its event was stored: only the reason survived. Now the `edit` event keeps
   `changes` (field, from, to) and the ticket detail returns them.
2. Nothing wrote the audit trail for cancel, restore or correct. Now each writes `ticket.cancel`, `ticket.restore` or
   `ticket.correct` through `ops.audit.record` (it exists; goal 2 makes it the only writer): before and after values, the reason in `after`.
3. A second person cancelling a ticket just cancelled got 403; it is a conflict (409), the same as every other command.
4. A correction to an unknown machine failed with 500; it is 404. A breakdown corrected to "no machine" is refused (409).
5. The API could not set hands-on and waiting minutes directly (DOMAIN §2, parity v3.actions.15). `activeMin` and `waitMin` are now
   accepted, kept as overrides on the ticket, marked in the figures, and the event records the minutes they replaced.

## Protected history (D24)

No change to protected rows was needed. A correction appends an `edit` event (insert only) and an audit row (insert only) and
updates the ticket row; work segments are not rewritten, so `ticket_event` and `work_segment` keep their revokes. If a later
correction has to move a segment, that is a history-protection change and gets its own design and review.

## Replay

BD-0077 (cancelled, restored, picked up, paused, resumed, closed) is now in the worker.js replay; restore goes through the admin
route. It equals his numbers except the three figures Nimish's ruling changes (cancelled time not counted): handover wait, downtime and repair.
